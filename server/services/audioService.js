import Course from '../models/Course.js';
import Module from '../models/Module.js';
import Lesson from '../models/Lesson.js';
import config from '../config/env.js';
import { sourceHashOf } from './audioSource.js';
import * as audioJobs from './audioJobs.js';
import * as audioStorage from './audioStorage.js';

// Hinglish audio for one lesson (Spec 6): status, start/retry and the file. Ownership follows the
// rest of the API: another user's course, or a lesson from another course, is a 404.

const httpError = (status, message) => Object.assign(new Error(message), { status });

const LIMIT_MESSAGE = "You've reached today's limit for new Hinglish audio. Try again tomorrow.";

// New jobs started per user per UTC day. In memory, so it resets on restart (single process only,
// like the 409 course-generation lock).
let usage = new Map(); // sub → { day, count }
const today = () => new Date().toISOString().slice(0, 10);
const usedToday = (sub) => {
  const entry = usage.get(sub);
  return entry?.day === today() ? entry.count : 0;
};
const countJob = (sub) => usage.set(sub, { day: today(), count: usedToday(sub) + 1 });

async function findOwned(sub, courseId, lessonId) {
  const course = await Course.findOne({ _id: courseId, creator: sub }).select('title options').lean();
  if (!course) throw httpError(404, 'Course not found.');
  const lesson = await Lesson.findOne({ _id: lessonId, course: courseId }).lean();
  if (!lesson) throw httpError(404, 'Lesson not found.');
  return { course, lesson };
}

// Ready audio counts only while it matches the lesson's current content.
const isFresh = (lesson) =>
  lesson.audio?.status === 'ready' && lesson.status === 'ready' && lesson.audio.sourceHash === sourceHashOf(lesson);

const isStale = (audio) =>
  audio?.status === 'generating' &&
  (!audio.startedAt || audio.startedAt.getTime() < Date.now() - config.audioTotalTimeoutMs - 60_000);

// The client shape. Never includes fileId, sourceHash, attempts, model names or lastError.
export function toAudioStatus(lesson) {
  const audio = lesson.audio;
  if (!audio) return { status: 'none', stage: null, error: null };
  if (audio.status === 'generating') return { status: 'generating', stage: audio.stage ?? 'script', error: null };
  if (audio.status === 'failed') {
    return {
      status: 'failed',
      stage: null,
      error: audioJobs.AUDIO_ERROR_MESSAGES[audio.errorKind] ?? audioJobs.AUDIO_ERROR_MESSAGES.failed,
    };
  }
  if (isFresh(lesson)) {
    return {
      status: 'ready',
      stage: null,
      durationSec: audio.durationSec,
      generatedAt: audio.generatedAt,
      voice: audio.voice,
      script: audio.script ?? [],
      error: null,
    };
  }
  return { status: 'none', stage: null, outdated: true, error: null };
}

// A job this process lost track of (restart) and that is past its deadline becomes 'failed'.
async function withRecovery(lesson) {
  if (!isStale(lesson.audio) || audioJobs.isTracked(lesson._id)) return lesson;
  await audioJobs.recoverStaleAudio({ _id: lesson._id });
  return (await Lesson.findById(lesson._id).lean()) ?? lesson;
}

export async function getAudioStatus(sub, courseId, lessonId) {
  const { lesson } = await findOwned(sub, courseId, lessonId);
  return toAudioStatus(await withRecovery(lesson));
}

/**
 * Starts a job, or answers from the current state. Resolves to { code, body }:
 * 200 with the ready status (cache hit, no Gemini call), or 202 while generating.
 */
export async function startAudio(sub, courseId, lessonId) {
  const owned = await findOwned(sub, courseId, lessonId);
  const { course } = owned;
  if (!course.options?.hinglishAudio) throw httpError(409, 'Hinglish audio is off for this course.');
  if ((owned.lesson.status ?? 'pending') !== 'ready') throw httpError(409, "This lesson isn't ready yet.");

  const lesson = await withRecovery(owned.lesson);
  const current = toAudioStatus(lesson);
  if (current.status === 'ready') return { code: 200, body: current };
  if (current.status === 'generating') return { code: 202, body: { status: 'generating', stage: current.stage } };

  if (usedToday(sub) >= config.audioDailyLimitPerUser) throw httpError(429, LIMIT_MESSAGE);

  // Atomic claim: only one caller can move the lesson into 'generating'. A null `audio` is replaced
  // whole (MongoDB can't set a field inside null); otherwise only failed or outdated audio is claimed.
  const hash = sourceHashOf(lesson);
  const startedAt = new Date();
  const base = { _id: lessonId, course: courseId, status: 'ready' };
  const claimed = lesson.audio
    ? await Lesson.findOneAndUpdate(
        {
          ...base,
          $or: [{ 'audio.status': 'failed' }, { 'audio.status': 'ready', 'audio.sourceHash': { $ne: hash } }],
        },
        {
          $set: { 'audio.status': 'generating', 'audio.stage': 'script', 'audio.startedAt': startedAt },
          $unset: { 'audio.errorKind': '', 'audio.lastError': '' },
          $inc: { 'audio.attempts': 1 },
        },
        { returnDocument: 'after' },
      ).lean()
    : await Lesson.findOneAndUpdate(
        { ...base, audio: null },
        { $set: { audio: { status: 'generating', stage: 'script', language: 'hinglish', startedAt, attempts: 1 } } },
        { returnDocument: 'after' },
      ).lean();

  if (!claimed) {
    // Someone else (another click or tab) got there first: answer from what is there now.
    const now = await Lesson.findById(lessonId).lean();
    const status = now ? toAudioStatus(now) : { status: 'none', stage: null, error: null };
    return { code: status.status === 'ready' ? 200 : 202, body: status };
  }

  countJob(sub);
  audioJobs.enqueue({ lessonId, courseId, startedAt: claimed.audio.startedAt });
  return { code: 202, body: { status: 'generating', stage: 'script' } };
}

const slug = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '') || 'course';

/** { fileId, length, filename } of fresh audio, or 404. */
export async function getAudioFile(sub, courseId, lessonId) {
  const { course, lesson } = await findOwned(sub, courseId, lessonId);
  if (!isFresh(lesson) || !lesson.audio.fileId) throw httpError(404, 'Audio not found.');
  const info = await audioStorage.fileInfo(lesson.audio.fileId);
  if (!info) throw httpError(404, 'Audio not found.');
  const module = await Module.findById(lesson.module).select('order').lean();
  return {
    fileId: lesson.audio.fileId,
    length: info.length,
    filename: `${slug(course.title)}-m${module?.order ?? 0}-l${lesson.order}-hinglish.mp3`,
  };
}

export function _resetForTests() {
  usage = new Map();
}
