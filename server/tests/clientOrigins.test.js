import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { parseClientOrigins } from '../config/parseClientOrigins.js';

const LIVE = 'https://text-to-learn.vercel.app';
const LOCAL = 'http://localhost:5173';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('parseClientOrigins', () => {
  it('keeps a single value as a list of one', () => {
    expect(parseClientOrigins(LOCAL)).toEqual([LOCAL]);
  });

  it('splits on commas and trims each entry', () => {
    expect(parseClientOrigins(`  ${LIVE} ,  ${LOCAL}  `)).toEqual([LIVE, LOCAL]);
  });

  it('ignores empty entries', () => {
    expect(parseClientOrigins(`,${LIVE},, ,${LOCAL},`)).toEqual([LIVE, LOCAL]);
  });

  it('finds no origins in an unset or all-empty value', () => {
    expect(parseClientOrigins(undefined)).toEqual([]);
    expect(parseClientOrigins('')).toEqual([]);
    expect(parseClientOrigins(' , ,')).toEqual([]);
  });
});

describe('config', () => {
  it('refuses to start when CLIENT_ORIGIN has only empty entries', async () => {
    vi.stubEnv('CLIENT_ORIGIN', ' , ,');
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {});
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    await import('../config/env.js');

    expect(exit).toHaveBeenCalledWith(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('CLIENT_ORIGIN'));
  });
});

describe('CORS', () => {
  let app;

  // config is read at import time, so the app is imported (once) after the variable is set.
  beforeAll(async () => {
    vi.resetModules();
    vi.stubEnv('CLIENT_ORIGIN', `${LIVE}, ${LOCAL}`);
    ({ default: app } = await import('../app.js'));
  });

  it.each([LIVE, LOCAL])('allows the listed origin %s', async (origin) => {
    const res = await request(app).get('/api/health').set('Origin', origin);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(res.headers['access-control-allow-origin']).toBe(origin);
  });

  it('sends no allow-origin header to any other origin', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'https://evil.example.com');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
