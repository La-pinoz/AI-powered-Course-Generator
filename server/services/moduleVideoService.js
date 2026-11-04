import Course from '../models/Course.js';
import Module from '../models/Module.js';
import config from '../config/env.js';
import * as videoJobs from './videoJobs.js';
import { assertCanFetchDetails, assertCanSearch, countSearch, isStopActive, turnOnStop } from './videoLimits.js';
import { getVideoDetails } from './youtubeClient.js';

// A module's YouTube video (Spec 7). Ownership follows the rest of the API: another user's course, or
// a module from another course, is a 404.

const RECHECK_AFTER_MS = 7 * 24 * 60 * 60_000;
const RECHECK_TIMEOUT_MS = 10_000;
const REPORT_ATTEMPTS = 3;
const UNAVAILABLE_VIDEO = "That video isn't available for this module.";

const httpError = (status, message) => Object.assign(new Error(message), { status });

async function findOwned(sub, courseId, moduleId) {
  const course = await Course.exists({ _id: courseId, creator: sub });
  if (!course) throw httpError(404, 'Course not found.');
  const module = await Module.findOne({ _id: moduleId, course: courseId }).lean();
  if (!module) throw httpError(404, 'Module not found.');
  return module;
}

const canSearchAgain = (video) => video.status === 'none' && (video.searchCount < 2 || video.lostAllVideos === true);

// The client shape. Never includes unapproved candidates, the phrase, counts, or the error reason.
export function toVideoBody(video) {
  const body = { status: video.status, selectedVideoId: null, approved: [], canSearchAgain: false, error: null };
  if (video.status === 'ready') {
    const byId = new Map((video.candidates ?? []).map((c) => [c.videoId, c]));
    body.selectedVideoId = video.selectedVideoId;
    body.approved = (video.approvedIds ?? [])
      .filter((id) => byId.has(id))
      .map((id) => {
        const { videoId, title, channelTitle, durationSec } = byId.get(id);
        return { videoId, title, channelTitle, durationSec };
      });
  }
  if (video.status === 'none') body.canSearchAgain = canSearchAgain(video);
  if (video.status === 'failed') {
    body.error = videoJobs.VIDEO_ERROR_MESSAGES[video.errorKind] ?? videoJobs.VIDEO_ERROR_MESSAGES.failed;
  }
  return body;
}

// A job this process lost track of (restart) and that is past the longest job becomes 'failed'.
async function withRecovery(module) {
  const video = module.video;
  const stale =
    video?.status === 'searching' &&
    (!video.startedAt || new Date(video.startedAt).getTime() < Date.now() - videoJobs.STALE_AFTER_MS);
  if (!stale || videoJobs.isTracked(module._id)) return module;
  await videoJobs.markInterrupted(module._id);
  return (await Module.findById(module._id).lean()) ?? module;
}

// Removing ids from the approved list: the selection moves to the next approved video, looping. If
// none are left the module becomes 'none' and one more Search again opens up.
function afterRemoving(video, deadIds) {
  const dead = new Set(deadIds);
  const approvedIds = video.approvedIds.filter((id) => !dead.has(id));
  if (approvedIds.length === 0) {
    return {
      'video.status': 'none',
      'video.approvedIds': [],
      'video.selectedVideoId': null,
      'video.lostAllVideos': true,
    };
  }
  let selected = video.selectedVideoId;
  if (dead.has(selected)) {
    const count = video.approvedIds.length;
    const start = video.approvedIds.indexOf(selected);
    selected = approvedIds[0];
    for (let step = 1; step < count; step++) {
      const id = video.approvedIds[(start + step) % count];
      if (!dead.has(id)) {
        selected = id;
        break;
      }
    }
  }
  return { 'video.approvedIds': approvedIds, 'video.selectedVideoId': selected };
}

// --- Background re-check ---------------------------------------------------------------------------

const rechecking = new Set();

const unchanged = (moduleId, video) => ({
  _id: moduleId,
  'video.status': 'ready',
  'video.approvedIds': video.approvedIds,
  'video.selectedVideoId': video.selectedVideoId,
});

async function recheck(moduleId, approvedIds) {
  const kept = await getVideoDetails(approvedIds, { timeoutMs: RECHECK_TIMEOUT_MS, retries: 0 });
  // The learner may have acted during the call, so apply the result to what is there now.
  const current = (await Module.findById(moduleId).select('video').lean())?.video;
  if (current?.status !== 'ready') return;
  const keptIds = new Set(kept.map((c) => c.videoId));
  const dead = current.approvedIds.filter((id) => !keptIds.has(id));
  await Module.updateOne(unchanged(moduleId, current), {
    $set: { ...afterRemoving(current, dead), 'video.candidates': kept, 'video.checkedAt': new Date() },
  });
}

function startRecheckIfDue(module) {
  const { video } = module;
  const checkedAt = video.checkedAt ? new Date(video.checkedAt).getTime() : 0;
  if (video.status !== 'ready' || Date.now() - checkedAt <= RECHECK_AFTER_MS) return;
  const id = String(module._id);
  if (!config.youtubeApiKey || isStopActive('details') || rechecking.has(id)) return;

  rechecking.add(id);
  const run = recheck(module._id, video.approvedIds)
    .catch((err) => {
      if (err?.kind === 'quota') turnOnStop('details');
      // checkedAt stays as it was, so the next open tries again.
      console.warn(`[video] re-check of module ${id} failed: ${String(err?.message).slice(0, 200)}`);
    })
    .finally(() => rechecking.delete(id));
  videoJobs.track(run);
}

// --- Starting and resuming jobs --------------------------------------------------------------------

const SEARCHING_BODY = () => toVideoBody({ status: 'searching' });

// Answers from what is there now, after another click or tab won the claim.
async function currentBody(moduleId) {
  const now = await Module.findById(moduleId).select('video').lean();
  return now?.video ? toVideoBody(now.video) : SEARCHING_BODY();
}

// Atomic: `video: null` is replaced whole (MongoDB can't set a field inside null).
async function startFirstSearch(sub, courseId, moduleId) {
  assertCanSearch(sub);
  const startedAt = new Date();
  const claimed = await Module.findOneAndUpdate(
    { _id: moduleId, course: courseId, video: null },
    { $set: { video: { status: 'searching', startedAt, searchCount: 0, candidates: [], approvedIds: [] } } },
    { returnDocument: 'after' },
  ).lean();
  if (!claimed) return currentBody(moduleId);
  countSearch(sub);
  videoJobs.enqueue({ moduleId, courseId, startedAt: claimed.video.startedAt, sub, counted: true });
  return SEARCHING_BODY();
}

export async function getVideo(sub, courseId, moduleId) {
  const module = await withRecovery(await findOwned(sub, courseId, moduleId));
  if (!module.video) return startFirstSearch(sub, courseId, moduleId);
  startRecheckIfDue(module); // not awaited: the saved video goes out straight away
  return toVideoBody(module.video);
}

/** Try again and Search again. Resolves to { code, body }. */
export async function retryVideo(sub, courseId, moduleId) {
  const module = await withRecovery(await findOwned(sub, courseId, moduleId));
  const { video } = module;

  if (!video) return { code: 202, body: await startFirstSearch(sub, courseId, moduleId) };
  if (video.status === 'searching') return { code: 202, body: toVideoBody(video) };
  if (video.status === 'ready') return { code: 200, body: toVideoBody(video) };
  if (video.status === 'none' && !canSearchAgain(video)) {
    throw httpError(409, 'This module has already been searched again.');
  }

  const hasCandidates = video.status === 'failed' && (video.candidates?.length ?? 0) > 0;
  const willSearch = !hasCandidates;
  if (willSearch) assertCanSearch(sub);
  else if (!video.fetchedAt) assertCanFetchDetails();

  const startedAt = new Date();
  const set = { 'video.status': 'searching', 'video.startedAt': startedAt };
  const unset = { 'video.errorKind': '', 'video.lastError': '' };
  if (video.status === 'none') {
    // Each loss of all videos reopens exactly one search.
    Object.assign(set, {
      'video.candidates': [],
      'video.approvedIds': [],
      'video.selectedVideoId': null,
      'video.lostAllVideos': false,
    });
    unset['video.fetchedAt'] = '';
  }
  const claimed = await Module.findOneAndUpdate(
    { _id: moduleId, course: courseId, 'video.status': video.status },
    { $set: set, $unset: unset },
    { returnDocument: 'after' },
  ).lean();
  if (!claimed) {
    const body = await currentBody(moduleId);
    return { code: body.status === 'ready' ? 200 : 202, body };
  }

  if (willSearch) countSearch(sub);
  videoJobs.enqueue({ moduleId, courseId, startedAt: claimed.video.startedAt, sub, counted: willSearch });
  return { code: 202, body: SEARCHING_BODY() };
}

/** Show another video: saves the choice. */
export async function selectVideo(sub, courseId, moduleId, videoId) {
  await findOwned(sub, courseId, moduleId);
  if (typeof videoId !== 'string') throw httpError(400, UNAVAILABLE_VIDEO);
  const updated = await Module.findOneAndUpdate(
    { _id: moduleId, course: courseId, 'video.status': 'ready', 'video.approvedIds': videoId },
    { $set: { 'video.selectedVideoId': videoId } },
    { returnDocument: 'after' },
  ).lean();
  if (!updated) throw httpError(400, UNAVAILABLE_VIDEO);
  return toVideoBody(updated.video);
}

/** A player error: removes the video for this course's one owner and moves on. A repeat is harmless. */
export async function reportUnavailable(sub, courseId, moduleId, videoId) {
  let module = await findOwned(sub, courseId, moduleId);
  if (typeof videoId !== 'string') throw httpError(400, UNAVAILABLE_VIDEO);

  for (let attempt = 0; attempt < REPORT_ATTEMPTS; attempt++) {
    const { video } = module;
    if (video?.status !== 'ready' || !video.approvedIds.includes(videoId)) break;
    const updated = await Module.findOneAndUpdate(
      unchanged(moduleId, video),
      { $set: afterRemoving(video, [videoId]) },
      { returnDocument: 'after' },
    ).lean();
    if (updated) return toVideoBody(updated.video);
    module = await Module.findById(moduleId).lean(); // changed under us: try again from the new state
    if (!module) throw httpError(404, 'Module not found.');
  }
  return module.video ? toVideoBody(module.video) : toVideoBody({ status: 'none', searchCount: 0 });
}
