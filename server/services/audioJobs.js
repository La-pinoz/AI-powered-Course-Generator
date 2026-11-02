import Course from '../models/Course.js';
import Lesson from '../models/Lesson.js';
import config from '../config/env.js';
import { buildAudioSource, extractKeyTerms, hashSource } from './audioSource.js';
import { generateHinglishScript } from './hinglishScriptService.js';
import { synthesize } from './ttsService.js';
import { encodeMp3 } from '../utils/audioEncoding.js';
import * as audioStorage from './audioStorage.js';

// In-memory runner for Hinglish audio jobs (Spec 6). Like the lesson queue it only works for a
// single server process; a job's state lives on the lesson (`audio.status`), so a restart only
// loses the in-flight work, which recoverStaleAudio() then marks failed.

export const PIPELINE_VERSION = 1;

// The only error texts the client ever sees; `errorKind` on the lesson picks one.
export const AUDIO_ERROR_MESSAGES = {
  busy: 'The audio service is busy right now. Please try again in a minute.',
  failed: "We couldn't make the audio this time. Please try again.",
  timeout: 'Making the audio took too long. Please try again.',
  empty: 'This lesson has nothing to explain in audio.',
  interrupted: 'The audio service is busy right now. Please try again in a minute.',
};

let queue = []; // { lessonId, courseId, startedAt }
let running = 0;
const inflight = new Set();
const runningLessons = new Set(); // lessonIds of running jobs

const idOf = (value) => String(value);

const kindOf = (err) => {
  if (err?.kind === 'empty') return 'empty';
  if (err?.status === 503) return 'busy';
  if (err?.status === 504) return 'timeout';
  return 'failed';
};

// Updates only the job that owns the lesson right now (same startedAt), so a stale job can never
// overwrite a newer one.
const ownJob = (lessonId, startedAt) => ({ _id: lessonId, 'audio.status': 'generating', 'audio.startedAt': startedAt });

async function markFailed(job, kind, message) {
  await Lesson.updateOne(ownJob(job.lessonId, job.startedAt), {
    $set: {
      'audio.status': 'failed',
      'audio.stage': null,
      'audio.errorKind': kind,
      'audio.lastError': String(message ?? kind).slice(0, 500),
    },
  });
}

async function runJob(job) {
  const t0 = Date.now();
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(), config.audioTotalTimeoutMs);
  let newFileId = null;

  try {
    const lesson = await Lesson.findOne(ownJob(job.lessonId, job.startedAt)).lean();
    if (!lesson) return; // deleted, or a newer job owns it
    const course = await Course.findById(lesson.course).select('title creator').lean();
    if (!course) return;

    const source = buildAudioSource(lesson);
    if (!source.explainable) {
      await markFailed(job, 'empty', 'no explainable blocks');
      return;
    }
    if (source.truncated) console.info(`[audio] lesson ${job.lessonId}: source cut at the character cap`);
    const sourceHash = hashSource(source.text);
    const mcqQuestions = (lesson.content ?? []).filter((b) => b?.type === 'mcq').map((b) => b.question);

    // Step 1: the Hinglish script.
    const script = await generateHinglishScript({
      source: source.text,
      keyTerms: extractKeyTerms(lesson),
      courseTitle: course.title,
      mcqQuestions,
    });
    if (deadline.signal.aborted) throw Object.assign(new Error('job deadline'), { status: 504 });

    const moved = await Lesson.updateOne(ownJob(job.lessonId, job.startedAt), { $set: { 'audio.stage': 'voice' } });
    if (moved.matchedCount === 0) return;

    // Step 2: speech, then MP3.
    const speech = await synthesize(script.segments, { signal: deadline.signal });
    const { mp3, durationSec } = await encodeMp3(speech.pcm, speech.sampleRate); // worker thread

    newFileId = await audioStorage.saveFile(mp3, {
      lessonId: job.lessonId,
      courseId: lesson.course,
      creator: course.creator,
      sourceHash,
    });

    const saved = await Lesson.updateOne(ownJob(job.lessonId, job.startedAt), {
      $set: {
        'audio.status': 'ready',
        'audio.stage': null,
        'audio.language': 'hinglish',
        'audio.script': script.segments,
        'audio.fileId': newFileId,
        'audio.mimeType': 'audio/mpeg',
        'audio.bytes': mp3.length,
        'audio.durationSec': durationSec,
        'audio.voice': config.ttsVoice,
        'audio.scriptModel': script.model,
        'audio.ttsModel': speech.model,
        'audio.pipelineVersion': PIPELINE_VERSION,
        'audio.sourceHash': sourceHash,
        'audio.generatedAt': new Date(),
      },
      $unset: { 'audio.errorKind': '', 'audio.lastError': '' },
    });

    if (saved.matchedCount === 0) {
      // The lesson was deleted (or reclaimed) while we worked: don't leave the file behind.
      await audioStorage.deleteFile(newFileId);
      return;
    }
    const previousFileId = lesson.audio?.fileId;
    if (previousFileId && idOf(previousFileId) !== idOf(newFileId)) {
      await audioStorage.deleteFile(previousFileId).catch((err) => console.warn('[audio] old file delete failed:', err.message));
    }

    console.info(
      `[audio] lesson ${job.lessonId} ready: script=${script.model} tts=${speech.model} chunks=${speech.chunks} ` +
        `duration=${durationSec}s bytes=${mp3.length} took=${Date.now() - t0}ms`,
    );
  } catch (err) {
    const kind = deadline.signal.aborted && kindOf(err) !== 'empty' ? 'timeout' : kindOf(err);
    console.error(`[audio] lesson ${job.lessonId} failed (${kind}) after ${Date.now() - t0}ms: ${String(err?.message).slice(0, 200)}`);
    if (newFileId) await audioStorage.deleteFile(newFileId).catch(() => {});
    await markFailed(job, kind, err?.message).catch((e) => console.error('[audio] could not mark failed:', e.message));
  } finally {
    clearTimeout(timer);
  }
}

function pump() {
  while (running < config.audioGenConcurrency && queue.length > 0) {
    const job = queue.shift();
    running++;
    runningLessons.add(job.lessonId);
    const promise = runJob(job).finally(() => {
      running--;
      runningLessons.delete(job.lessonId);
      inflight.delete(promise);
      pump();
    });
    inflight.add(promise);
  }
}

/** Queues a job the caller has already claimed (audio.status 'generating', audio.startedAt). */
export function enqueue({ lessonId, courseId, startedAt }) {
  queue.push({ lessonId: idOf(lessonId), courseId: idOf(courseId), startedAt });
  pump();
}

/** Drops a course's queued jobs. A running job finds its lesson gone and discards its result. */
export function cancelCourse(courseId) {
  const course = idOf(courseId);
  queue = queue.filter((job) => job.courseId !== course);
}

/** True while this process has the lesson's job queued or running. */
export const isTracked = (lessonId) =>
  runningLessons.has(idOf(lessonId)) || queue.some((job) => job.lessonId === idOf(lessonId));

/**
 * Boot (and per-lesson) recovery: a job still 'generating' well past its deadline was interrupted
 * by a restart, so it becomes 'failed' and the user's Try again restarts it.
 */
export async function recoverStaleAudio(filter = {}) {
  const cutoff = new Date(Date.now() - config.audioTotalTimeoutMs - 60_000);
  await Lesson.updateMany(
    { ...filter, 'audio.status': 'generating', 'audio.startedAt': { $lt: cutoff } },
    {
      $set: {
        'audio.status': 'failed',
        'audio.stage': null,
        'audio.errorKind': 'interrupted',
        'audio.lastError': 'interrupted (server restart or job lost)',
      },
    },
  );
}

/** Resolves when no job is running and nothing more can start. For tests. */
export async function whenIdle() {
  while (inflight.size > 0) await Promise.allSettled([...inflight]);
}

export function _resetForTests() {
  queue = [];
  running = 0;
  inflight.clear();
  runningLessons.clear();
}
