import config from '../config/env.js';

// The per-user search cap and the two YouTube quota stops (Spec 7). All in memory, so they reset on
// restart and only work for a single server process, like the course-generation lock.

export const LIMIT_MESSAGE = "You've reached today's limit for finding new videos. Try again tomorrow.";
export const UNAVAILABLE_MESSAGE = "Videos aren't available right now.";
export const QUOTA_MESSAGE = 'Video search has reached its daily limit. Please try again later.';

const httpError = (status, message) => Object.assign(new Error(message), { status });

// --- Per-user cap: searches per UTC day ----------------------------------------------------------

let usage = new Map(); // sub → { day, count }
const today = () => new Date(Date.now()).toISOString().slice(0, 10);
const usedToday = (sub) => {
  const entry = usage.get(sub);
  return entry?.day === today() ? entry.count : 0;
};

export const countSearch = (sub) => usage.set(sub, { day: today(), count: usedToday(sub) + 1 });
export const refundSearch = (sub) => usage.set(sub, { day: today(), count: Math.max(0, usedToday(sub) - 1) });

// --- Quota stops ---------------------------------------------------------------------------------

const PACIFIC = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});

// { year, month, day, hour, minute, second } on a Pacific clock.
const pacificParts = (ms) =>
  Object.fromEntries(
    PACIFIC.formatToParts(new Date(ms))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );

// How far the Pacific clock is from UTC at this moment; changes with daylight saving.
const pacificOffset = (ms) => {
  const p = pacificParts(ms);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
};

/** The next midnight in America/Los_Angeles, as a timestamp. */
export function nextPacificMidnight(now = Date.now()) {
  const p = pacificParts(now);
  const midnightOnClock = Date.UTC(p.year, p.month - 1, p.day + 1);
  const estimate = midnightOnClock - pacificOffset(now);
  // The offset may differ at midnight itself on a daylight-saving change day.
  return midnightOnClock - pacificOffset(estimate);
}

const stops = { search: 0, details: 0 }; // timestamp each stop lasts until

/** `which` is 'search' or 'details': the call that got quotaExceeded. */
export const turnOnStop = (which) => {
  stops[which] = nextPacificMidnight();
};
export const isStopActive = (which) => Date.now() < stops[which];

// --- What a request may do -----------------------------------------------------------------------

/** Throws a 503 unless details can be fetched. */
export function assertCanFetchDetails() {
  if (!config.youtubeApiKey) throw httpError(503, UNAVAILABLE_MESSAGE);
  if (isStopActive('details')) throw httpError(503, QUOTA_MESSAGE);
}

/**
 * Throws a 503 or 429 unless a new search may start. Either stop blocks it, because a search can't
 * finish without details and would waste a search call.
 */
export function assertCanSearch(sub) {
  assertCanFetchDetails();
  if (isStopActive('search')) throw httpError(503, QUOTA_MESSAGE);
  if (usedToday(sub) >= config.videoDailyLimitPerUser) throw httpError(429, LIMIT_MESSAGE);
}

export function _resetForTests() {
  usage = new Map();
  stops.search = 0;
  stops.details = 0;
}
