import Course from '../models/Course.js';
import Module from '../models/Module.js';
import Lesson from '../models/Lesson.js';
import config from '../config/env.js';
import { generateVideoQuery } from './videoQueryService.js';
import { rankVideoCandidates } from './videoRankService.js';
import { getVideoDetails, searchVideos } from './youtubeClient.js';
import { isStopActive, refundSearch, turnOnStop } from './videoLimits.js';

// In-memory runner for module video searches (Spec 7). Like the lesson queue it only works for a single
// server process; a job's state lives on the module (`video.status`), so a restart only loses the
// in-flight work. Steps resume from what is saved, so Try again never repeats a search that succeeded.

export const STALE_AFTER_MS = 3 * 60_000;

// The only error texts the client ever sees; `errorKind` on the module picks one.
export const VIDEO_ERROR_MESSAGES = {
  quota: 'Video search has reached its daily limit. Please try again later.',
  busy: 'The video service is busy right now. Please try again in a minute.',
  timeout: 'Finding a video took too long. Please try again.',
  failed: "We couldn't find a video this time. Please try again.",
  interrupted: 'The video service is busy right now. Please try again in a minute.',
};

let queue = []; // { moduleId, courseId, startedAt, sub, counted }
let running = 0;
const inflight = new Set();
const runningModules = new Set();

const idOf = (value) => String(value);

const kindOf = (err) => {
  if (err?.kind) return err.kind; // from youtubeClient: 'quota' | 'busy' | 'failed'
  if (err?.status === 503) return 'busy';
  if (err?.status === 504) return 'timeout';
  return 'failed';
};

const quotaStopped = (which) => Object.assign(new Error(`${which} stop is on`), { kind: 'quota' });

// Updates only the job that owns the module right now, so a stale job can never overwrite a newer one
// and a deleted module's result is dropped.
const ownJob = (job) => ({ _id: job.moduleId, 'video.status': 'searching', 'video.startedAt': job.startedAt });

const finishNone = (job) =>
  Module.updateOne(ownJob(job), {
    $set: { 'video.status': 'none', 'video.approvedIds': [], 'video.selectedVideoId': null },
    $unset: { 'video.errorKind': '', 'video.lastError': '' },
  });

async function callYouTube(which, call) {
  // The job may have waited in the queue since its claim, so check again right before the call.
  if (isStopActive(which)) throw quotaStopped(which);
  try {
    return await call();
  } catch (err) {
    if (err?.kind === 'quota') turnOnStop(which); // only the pool that ran out
    throw err;
  }
}

async function runJob(job) {
  const t0 = Date.now();
  let searched = false;
  let candidateCount = 0;
  let approvedCount = 0;

  try {
    const module = await Module.findOne(ownJob(job)).lean();
    if (!module) return; // deleted, or a newer job owns it
    const course = await Course.findById(job.courseId).select('title depth').lean();
    if (!course) return;
    const lessons = await Lesson.find({ module: job.moduleId })
      .select('title objectives order summary videoQuery')
      .sort({ order: 1 })
      .lean();

    let { candidates = [], fetchedAt } = module.video;

    // Steps 1 and 2: the phrase, then the one search call.
    if (candidates.length === 0) {
      // A search can't finish without details, so a details stop also stops it here.
      if (isStopActive('details')) throw quotaStopped('details');
      if (isStopActive('search')) throw quotaStopped('search');
      const previousQuery = module.video.searchCount >= 1 ? module.video.query : null;
      const query = await generateVideoQuery({ course, module, lessons, previousQuery });
      const results = await callYouTube('search', () => {
        searched = true;
        return searchVideos(query);
      });
      const saved = await Module.updateOne(ownJob(job), {
        $set: { 'video.query': query, 'video.candidates': results },
        $inc: { 'video.searchCount': 1 },
      });
      if (saved.matchedCount === 0) return;
      if (results.length === 0) {
        await finishNone(job);
        return;
      }
      candidates = results;
      fetchedAt = null;
    }

    // Step 3: details, and the keep rules.
    if (!fetchedAt) {
      const kept = await callYouTube('details', () => getVideoDetails(candidates.map((c) => c.videoId)));
      const now = new Date();
      const saved = await Module.updateOne(ownJob(job), {
        $set: { 'video.candidates': kept, 'video.fetchedAt': now, 'video.checkedAt': now },
      });
      if (saved.matchedCount === 0) return;
      if (kept.length === 0) {
        await finishNone(job);
        return;
      }
      candidates = kept;
    }
    candidateCount = candidates.length;

    // Step 4: Gemini approves and orders.
    const approved = await rankVideoCandidates({ course, module, lessons, candidates });
    approvedCount = approved.length;
    if (approved.length === 0) {
      await finishNone(job);
      return;
    }
    await Module.updateOne(ownJob(job), {
      $set: { 'video.status': 'ready', 'video.approvedIds': approved, 'video.selectedVideoId': approved[0] },
      $unset: { 'video.errorKind': '', 'video.lastError': '' },
    });
  } catch (err) {
    const kind = kindOf(err);
    console.error(`[video] module ${job.moduleId} failed (${kind}) after ${Date.now() - t0}ms: ${String(err?.message).slice(0, 200)}`);
    await Module.updateOne(ownJob(job), {
      $set: {
        'video.status': 'failed',
        'video.errorKind': kind,
        'video.lastError': String(err?.message ?? kind).slice(0, 500),
      },
    }).catch((e) => console.error('[video] could not mark failed:', e.message));
  } finally {
    if (job.counted && !searched) refundSearch(job.sub);
    console.info(
      `[video] module ${job.moduleId}: searched=${searched} candidates=${candidateCount} approved=${approvedCount} took=${Date.now() - t0}ms`,
    );
  }
}

/** Keeps `promise` visible to whenIdle. Also used for background re-checks. */
export function track(promise) {
  inflight.add(promise);
  promise.finally(() => inflight.delete(promise)).catch(() => {});
}

function pump() {
  while (running < config.videoGenConcurrency && queue.length > 0) {
    const job = queue.shift();
    running++;
    runningModules.add(job.moduleId);
    track(
      runJob(job).finally(() => {
        running--;
        runningModules.delete(job.moduleId);
        pump();
      }),
    );
  }
}

/** Queues a job the caller has already claimed. `counted`: it used one of the user's daily searches. */
export function enqueue({ moduleId, courseId, startedAt, sub, counted }) {
  queue.push({ moduleId: idOf(moduleId), courseId: idOf(courseId), startedAt, sub, counted });
  pump();
}

/** Drops a course's queued jobs. A running job's writes match nothing once its module is gone. */
export function cancelCourse(courseId) {
  const course = idOf(courseId);
  queue = queue.filter((job) => job.courseId !== course);
}

/** True while this process has the module's job queued or running. */
export const isTracked = (moduleId) =>
  runningModules.has(idOf(moduleId)) || queue.some((job) => job.moduleId === idOf(moduleId));

/** A search still 'searching' well past the longest job was interrupted by a restart. */
export async function markInterrupted(moduleId) {
  await Module.updateOne(
    { _id: moduleId, 'video.status': 'searching', 'video.startedAt': { $lt: new Date(Date.now() - STALE_AFTER_MS) } },
    {
      $set: {
        'video.status': 'failed',
        'video.errorKind': 'interrupted',
        'video.lastError': 'interrupted (server restart or job lost)',
      },
    },
  );
}

/** Resolves when no job or re-check is running and nothing more can start. For tests. */
export async function whenIdle() {
  while (inflight.size > 0) await Promise.allSettled([...inflight]);
}

export function _resetForTests() {
  queue = [];
  running = 0;
  inflight.clear();
  runningModules.clear();
}
