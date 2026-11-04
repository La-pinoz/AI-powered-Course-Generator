import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));

const { getVideoDetails, parseDuration, searchVideos } = await import('../services/youtubeClient.js');
const { parseRegionCode } = await import('../config/env.js');

const VID = 'aaaaaaaaaaa';

const item = (overrides = {}) => ({
  id: VID,
  snippet: { title: 'A & B', channelTitle: 'Chan', description: 'd'.repeat(500), publishedAt: '2026-01-01T00:00:00Z', liveBroadcastContent: 'none' },
  contentDetails: { duration: 'PT12M3S' },
  statistics: { viewCount: '1000', likeCount: '10' },
  status: { privacyStatus: 'public', embeddable: true },
  ...overrides,
});

const httpFailure = (status, data) => Object.assign(new Error('Request failed key=SECRET-KEY'), { response: { status, data } });

const quotaBody = { error: { code: 403, errors: [{ reason: 'quotaExceeded', domain: 'youtube.quota' }] } };

beforeEach(() => {
  axios.get.mockReset();
});

describe('searchVideos', () => {
  it('sends the agreed parameters', async () => {
    axios.get.mockResolvedValue({ data: { items: [] } });
    await searchVideos('react hooks explained');
    const [address, { params, timeout }] = axios.get.mock.calls[0];
    expect(address).toBe('https://www.googleapis.com/youtube/v3/search');
    expect(timeout).toBe(10_000);
    expect(params).toEqual({
      part: 'snippet',
      q: 'react hooks explained',
      type: 'video',
      videoEmbeddable: 'true',
      videoDuration: 'medium',
      safeSearch: 'strict',
      relevanceLanguage: 'en',
      regionCode: 'IN',
      maxResults: 10,
      key: 'test-key',
    });
  });

  it('leaves regionCode out when the setting is invalid', async () => {
    vi.resetModules();
    vi.stubEnv('YOUTUBE_REGION_CODE', 'India');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fresh = await import('../services/youtubeClient.js');
    const freshAxios = (await import('axios')).default;
    freshAxios.get.mockReset();
    freshAxios.get.mockResolvedValue({ data: { items: [] } });
    await fresh.searchVideos('react hooks explained');
    expect(freshAxios.get.mock.calls[0][1].params).not.toHaveProperty('regionCode');
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('is never retried, even when busy', async () => {
    axios.get.mockRejectedValue(httpFailure(503));
    await expect(searchVideos('a b c')).rejects.toMatchObject({ kind: 'busy' });
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it('drops results without a valid video id', async () => {
    axios.get.mockResolvedValue({
      data: { items: [{ id: { videoId: VID }, snippet: { title: 'T' } }, { id: { videoId: 'bad id' } }, { id: {} }] },
    });
    expect((await searchVideos('a b c')).map((c) => c.videoId)).toEqual([VID]);
  });
});

describe('error classification', () => {
  it.each([
    ['quotaExceeded in errors[]', 403, quotaBody, 'quota'],
    ['quotaExceeded elsewhere in the body', 403, { error: { status: 'quotaExceeded' } }, 'quota'],
    ['another 403', 403, { error: { errors: [{ reason: 'forbidden' }] } }, 'failed'],
    ['a bad key', 400, { error: { errors: [{ reason: 'keyInvalid' }] } }, 'failed'],
    ['rate limited', 429, {}, 'busy'],
    ['a server error', 500, {}, 'busy'],
  ])('%s', async (_name, status, data, kind) => {
    axios.get.mockRejectedValue(httpFailure(status, data));
    await expect(searchVideos('a b c')).rejects.toMatchObject({ kind });
  });

  it('a network error is busy', async () => {
    axios.get.mockRejectedValue(new Error('ECONNRESET'));
    await expect(searchVideos('a b c')).rejects.toMatchObject({ kind: 'busy' });
  });

  it('never passes on the axios message, which can carry the key', async () => {
    axios.get.mockRejectedValue(httpFailure(500));
    const err = await searchVideos('a b c').catch((e) => e);
    expect(err.message).not.toContain('SECRET-KEY');
  });
});

describe('getVideoDetails', () => {
  it('returns details with the agreed parts, a cut description and numeric counts', async () => {
    axios.get.mockResolvedValue({ data: { items: [item()] } });
    const [video] = await getVideoDetails([VID]);
    expect(axios.get.mock.calls[0][1].params.part).toBe('snippet,contentDetails,statistics,status');
    expect(video).toMatchObject({ videoId: VID, title: 'A & B', channelTitle: 'Chan', durationSec: 723, viewCount: 1000, likeCount: 10 });
    expect(video.description).toHaveLength(300);
  });

  it.each([
    ['private', { status: { privacyStatus: 'private', embeddable: true } }],
    ['unlisted', { status: { privacyStatus: 'unlisted', embeddable: true } }],
    ['not embeddable', { status: { privacyStatus: 'public', embeddable: false } }],
    ['live', { snippet: { liveBroadcastContent: 'live' } }],
    ['too short', { contentDetails: { duration: 'PT3M59S' } }],
    ['too long', { contentDetails: { duration: 'PT20M1S' } }],
    ['unreadable duration', { contentDetails: { duration: 'nonsense' } }],
  ])('drops a video that is %s', async (_name, overrides) => {
    axios.get.mockResolvedValue({ data: { items: [item(overrides)] } });
    expect(await getVideoDetails([VID])).toEqual([]);
  });

  it('keeps the exact 4 and 20 minute boundaries', async () => {
    for (const duration of ['PT4M', 'PT20M']) {
      axios.get.mockResolvedValue({ data: { items: [item({ contentDetails: { duration } })] } });
      expect(await getVideoDetails([VID])).toHaveLength(1);
    }
  });

  it('a missing id is simply not returned', async () => {
    axios.get.mockResolvedValue({ data: { items: [] } });
    expect(await getVideoDetails([VID])).toEqual([]);
  });

  it('turns hidden counts into null, not zero', async () => {
    axios.get.mockResolvedValue({ data: { items: [item({ statistics: {} })] } });
    const [video] = await getVideoDetails([VID]);
    expect(video.viewCount).toBeNull();
    expect(video.likeCount).toBeNull();
  });

  it('retries once on a network error or 5xx', async () => {
    axios.get.mockRejectedValueOnce(httpFailure(502)).mockResolvedValue({ data: { items: [item()] } });
    expect(await getVideoDetails([VID])).toHaveLength(1);
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  it('does not retry a quota error, or when retries are off', async () => {
    axios.get.mockRejectedValue(httpFailure(403, quotaBody));
    await expect(getVideoDetails([VID])).rejects.toMatchObject({ kind: 'quota' });
    expect(axios.get).toHaveBeenCalledTimes(1);

    axios.get.mockReset();
    axios.get.mockRejectedValue(httpFailure(500));
    await expect(getVideoDetails([VID], { retries: 0 })).rejects.toMatchObject({ kind: 'busy' });
    expect(axios.get).toHaveBeenCalledTimes(1);
  });
});

describe('small helpers', () => {
  it('parseDuration reads ISO 8601 and rejects anything else', () => {
    expect(parseDuration('PT12M3S')).toBe(723);
    expect(parseDuration('PT1H')).toBe(3600);
    expect(parseDuration('P1DT1S')).toBe(86_401);
    for (const bad of ['', 'P', 'PT', '12:03', undefined]) expect(parseDuration(bad)).toBeNull();
  });

  it('parseRegionCode defaults to IN, uppercases, and rejects bad values', () => {
    expect(parseRegionCode(undefined)).toBe('IN');
    expect(parseRegionCode('  ')).toBe('IN');
    expect(parseRegionCode('us')).toBe('US');
    expect(parseRegionCode('India')).toBeNull();
  });
});
