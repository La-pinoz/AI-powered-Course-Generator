import axios from 'axios';
import config from '../config/env.js';

// YouTube Data API v3 (Spec 7). Errors thrown from here have a `kind` ('quota' | 'busy' | 'failed') and
// a message we wrote: axios errors carry the request URL, which contains the API key, so they are
// never passed on or logged.

const BASE_URL = 'https://www.googleapis.com/youtube/v3';
const TIMEOUT_MS = 10_000;
const MIN_DURATION_SEC = 240; // videoDuration=medium is 4-20 minutes inclusive
const MAX_DURATION_SEC = 1200;
const DESCRIPTION_MAX = 300;
const VIDEO_ID = /^[\w-]{11}$/;

const clientError = (kind, message) => Object.assign(new Error(message), { kind });

function toClientError(err, call) {
  const status = err?.response?.status;
  if (!status) return clientError('busy', `${call}: no response`);
  const body = err.response.data;
  const reasons = (body?.error?.errors ?? []).map((e) => e?.reason);
  // The errors page documents the 403 and the reason, but not the JSON shape, so check the body too.
  const isQuota = status === 403 && (reasons.includes('quotaExceeded') || JSON.stringify(body ?? '').includes('quotaExceeded'));
  if (isQuota) return clientError('quota', `${call}: quotaExceeded`);
  const reason = reasons.find(Boolean);
  const label = `${call}: HTTP ${status}${reason ? ` ${reason}` : ''}`;
  return clientError(status === 429 || status >= 500 ? 'busy' : 'failed', label);
}

/** "PT12M3S" → 723. Anything it can't read is null, which fails the duration rule. */
export function parseDuration(value) {
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value ?? '');
  if (!match || value === 'P' || value.endsWith('T')) return null;
  const [days, hours, minutes, seconds] = match.slice(1).map((part) => Number(part ?? 0));
  return days * 86_400 + hours * 3600 + minutes * 60 + seconds;
}

const countOf = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const dateOf = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : undefined;
};

const shortText = (value) => String(value ?? '').trim().slice(0, DESCRIPTION_MAX);

/**
 * One search.list call, never retried, so a request can't spend a second search.
 * Resolves to candidates built from the snippets; videos.list replaces these values later.
 */
export async function searchVideos(query) {
  const params = {
    part: 'snippet',
    q: query,
    type: 'video',
    videoEmbeddable: 'true',
    videoDuration: 'medium',
    safeSearch: 'strict',
    relevanceLanguage: 'en',
    maxResults: 10,
    key: config.youtubeApiKey,
  };
  if (config.youtubeRegionCode) params.regionCode = config.youtubeRegionCode;

  let data;
  try {
    ({ data } = await axios.get(`${BASE_URL}/search`, { params, timeout: TIMEOUT_MS }));
  } catch (err) {
    throw toClientError(err, 'search.list');
  }
  return (data?.items ?? [])
    .filter((item) => VIDEO_ID.test(item?.id?.videoId ?? ''))
    .map((item) => ({
      videoId: item.id.videoId,
      title: item.snippet?.title,
      channelTitle: item.snippet?.channelTitle,
      description: shortText(item.snippet?.description),
      publishedAt: dateOf(item.snippet?.publishedAt),
    }));
}

// Public, embeddable, not live, and within the length range.
const isKept = (item, durationSec) =>
  item?.status?.privacyStatus === 'public' &&
  item?.status?.embeddable === true &&
  item?.snippet?.liveBroadcastContent === 'none' &&
  durationSec !== null &&
  durationSec >= MIN_DURATION_SEC &&
  durationSec <= MAX_DURATION_SEC &&
  VIDEO_ID.test(item?.id ?? '');

/**
 * One videos.list call (with `retries` more on a network error or 5xx). Resolves to the ids that pass
 * the keep rules, with fresh details. An id missing from the result is gone.
 */
export async function getVideoDetails(ids, { timeoutMs = TIMEOUT_MS, retries = 1 } = {}) {
  let data;
  for (let attempt = 0; ; attempt++) {
    try {
      ({ data } = await axios.get(`${BASE_URL}/videos`, {
        params: {
          part: 'snippet,contentDetails,statistics,status',
          id: ids.join(','),
          key: config.youtubeApiKey,
        },
        timeout: timeoutMs,
      }));
      break;
    } catch (err) {
      const failure = toClientError(err, 'videos.list');
      if (failure.kind !== 'busy' || err?.response?.status === 429 || attempt >= retries) throw failure;
    }
  }

  const kept = [];
  for (const item of data?.items ?? []) {
    const durationSec = parseDuration(item?.contentDetails?.duration);
    if (!isKept(item, durationSec)) continue;
    kept.push({
      videoId: item.id,
      title: item.snippet?.title,
      channelTitle: item.snippet?.channelTitle,
      description: shortText(item.snippet?.description),
      durationSec,
      viewCount: countOf(item.statistics?.viewCount),
      likeCount: countOf(item.statistics?.likeCount),
      publishedAt: dateOf(item.snippet?.publishedAt),
    });
  }
  return kept;
}
