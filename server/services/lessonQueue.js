import Course from '../models/Course.js';
import Module from '../models/Module.js';
import Lesson from '../models/Lesson.js';
import config from '../config/env.js';
import { generateLessonContent } from './lessonGenerationService.js';

// Background lesson writer. In memory, so it only works for a single server process (like the
// per-user 409 guard in courseService). Nothing here is persisted except each lesson's own status;
// ensureQueued() rebuilds the queue from the database, which also covers restarts and old courses.

const STALE_GENERATING_MS = 3 * 60 * 1000;

let queues = new Map(); // courseId → lessonId[] still to claim, in module then lesson order
const active = new Set(); // courseIds with a lesson being written right now (one per course)
const inflight = new Set(); // promises of running lesson jobs, for whenIdle()

const idOf = (value) => String(value);

// A lesson stuck in 'generating' after a restart goes back to 'pending'.
const resetStale = (filter = {}) =>
  Lesson.updateMany(
    { ...filter, status: 'generating', generationStartedAt: { $lt: new Date(Date.now() - STALE_GENERATING_MS) } },
    { $set: { status: 'pending' } },
  );

// Boot step. Lessons from before this feature have no `status`, so give them one, then free any
// lesson that a crash left in 'generating'. Nothing is enqueued here; opening a course does that.
export async function recoverStaleLessons() {
  await Lesson.updateMany(
    { status: { $exists: false } },
    { $set: { status: 'pending', attempts: 0, contentVersion: 1 } },
  );
  await resetStale();
}

// Adds the course's pending lessons to its queue (module order, then lesson order), skipping the
// ones already queued, and starts work. Safe to call as often as you like.
export async function ensureQueued(courseId) {
  const course = idOf(courseId);
  await resetStale({ course });

  const [modules, pending] = await Promise.all([
    Module.find({ course }).select('order').lean(),
    Lesson.find({ course, status: 'pending' }).select('module order').lean(),
  ]);
  const moduleOrder = new Map(modules.map((m) => [idOf(m._id), m.order]));
  pending.sort(
    (a, b) => (moduleOrder.get(idOf(a.module)) ?? 0) - (moduleOrder.get(idOf(b.module)) ?? 0) || a.order - b.order,
  );

  const ids = queues.get(course) ?? [];
  const queued = new Set(ids);
  for (const lesson of pending) {
    if (!queued.has(idOf(lesson._id))) ids.push(idOf(lesson._id));
  }
  if (ids.length > 0) queues.set(course, ids);
  pump();
}

// A lesson the user is waiting on jumps to the front of its course, and the course to the front
// of the line.
export function prioritize(courseId, lessonId) {
  const course = idOf(courseId);
  const lesson = idOf(lessonId);
  const ids = queues.get(course);
  if (!ids) return;
  const index = ids.indexOf(lesson);
  if (index === -1) return;
  ids.splice(index, 1);
  ids.unshift(lesson);
  queues = new Map([[course, ids], ...[...queues].filter(([key]) => key !== course)]);
  pump();
}

// Drops the course's queue. A lesson already being written finishes its Gemini call, but its
// result is discarded because the lesson no longer exists (or is no longer 'generating').
export function cancelCourse(courseId) {
  queues.delete(idOf(courseId));
}

// Resolves when no lesson is being written and nothing more can start. For tests.
export async function whenIdle() {
  while (inflight.size > 0) await Promise.allSettled([...inflight]);
}

export function _resetForTests() {
  queues = new Map();
  active.clear();
  inflight.clear();
}

// Starts one lesson for each waiting course that isn't busy, up to the global concurrency. A course
// gives its slot back after every lesson and goes to the back of the line, so a long course
// doesn't starve the others.
function pump() {
  for (const [course, ids] of [...queues]) {
    if (active.size >= config.lessonGenConcurrency) return;
    if (active.has(course)) continue;
    const lessonId = ids.shift();
    queues.delete(course);
    if (ids.length > 0) queues.set(course, ids);
    if (!lessonId) continue;

    active.add(course);
    const job = processLesson(course, lessonId).finally(() => {
      active.delete(course);
      inflight.delete(job);
      pump();
    });
    inflight.add(job);
  }
}

// Course, module and neighbouring lessons for the prompt. Null if the course is gone.
async function loadContext(courseId, lessonId) {
  const course = await Course.findById(courseId).select('title description').lean();
  if (!course) return null;
  const [modules, lessons] = await Promise.all([
    Module.find({ course: courseId }).select('title order').lean(),
    Lesson.find({ course: courseId }).select('module title order objectives').lean(),
  ]);
  const moduleById = new Map(modules.map((m) => [idOf(m._id), m]));
  const flat = lessons
    .filter((l) => moduleById.has(idOf(l.module)))
    .sort(
      (a, b) =>
        moduleById.get(idOf(a.module)).order - moduleById.get(idOf(b.module)).order || a.order - b.order,
    );
  const index = flat.findIndex((l) => idOf(l._id) === lessonId);
  if (index === -1) return null;
  const lesson = flat[index];
  return {
    course,
    module: moduleById.get(idOf(lesson.module)),
    lesson,
    prevLesson: flat[index - 1] ?? null,
    nextLesson: flat[index + 1] ?? null,
  };
}

// Writes one lesson. Never throws: a failure marks just this lesson 'failed' and the queue moves on.
async function processLesson(courseId, lessonId) {
  let claimed = false;
  try {
    const context = await loadContext(courseId, lessonId);
    if (!context) {
      queues.delete(courseId); // the course was deleted
      return;
    }

    // Atomic claim: a lesson can never be written twice at once.
    const lesson = await Lesson.findOneAndUpdate(
      { _id: lessonId, course: courseId, status: 'pending' },
      { $set: { status: 'generating', generationStartedAt: new Date() }, $inc: { attempts: 1 } },
      { returnDocument: 'after' },
    )
      .select('_id')
      .lean();
    if (!lesson) return;
    claimed = true;

    const result = await generateLessonContent(context);

    const now = new Date();
    await Lesson.updateOne(
      { _id: lessonId, status: 'generating' },
      {
        $set: {
          content: result.content,
          summary: result.summary,
          videoQuery: result.videoQuery,
          status: 'ready',
          isEnriched: true,
          generatedAt: now,
          contentVersion: 1,
        },
      },
    ); // matches nothing if the lesson was deleted meanwhile; the result is dropped
  } catch (err) {
    console.error(`[lessons] lesson ${lessonId} failed: ${String(err?.message).slice(0, 300)}`);
    if (claimed) {
      await Lesson.updateOne(
        { _id: lessonId, status: 'generating' },
        { $set: { status: 'failed', lastError: String(err?.message ?? 'Unknown error').slice(0, 500) } },
      ).catch((updateErr) => console.error('[lessons] could not mark lesson failed:', updateErr.message));
    }
  }
}
