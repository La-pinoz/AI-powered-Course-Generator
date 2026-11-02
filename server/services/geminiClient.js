import { GoogleGenAI } from '@google/genai';
import config from '../config/env.js';

// Shared Gemini plumbing: model rotation, per-attempt and overall timeouts, backoff and failure
// classification. Used by outline generation and lesson generation.

const MAX_ATTEMPTS = 3;
const MIN_REMAINING_MS = 5_000; // don't start an attempt with less than this left
const BACKOFF_MS = [1000, 2000]; // before a retry on the same model
const JITTER_MS = 250;

const httpError = (status, message) => Object.assign(new Error(message), { status });

let client;
const getClient = () => {
  client ??= new GoogleGenAI({ apiKey: config.geminiApiKey });
  return client;
};

// Primary model first, then the optional fallback. Read at call time so config changes are picked up.
const modelList = () => [...new Set([config.geminiModel, config.geminiFallbackModel].filter(Boolean))];

// 'config' = wrong key or model name (retrying the same model is pointless); everything else from
// the SDK (429, 5xx, network errors with no status) is treated as the service being busy.
const classifyApiError = (err) => ([400, 401, 403, 404].includes(Number(err?.status)) ? 'config' : 'busy');

const attemptFailure = (kind, err) => Object.assign(new Error(err?.message ?? kind), { kind, upstreamStatus: err?.status });

const sleep = (ms, signal) =>
  new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', done, { once: true });
  });

// One Gemini call with its own timeout, also aborted when the overall deadline hits.
// Resolves to `parse(text)`, or throws an error with `kind`: 'busy' | 'bad-output' | 'config'.
async function attemptOnce({ model, prompt, responseSchema, parse, attemptTimeoutMs }, deadlineSignal, budgetMs) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  deadlineSignal.addEventListener('abort', abort, { once: true });

  const aborted = new Promise((_, reject) => {
    controller.signal.addEventListener('abort', () => reject(attemptFailure('busy')), { once: true });
  });
  aborted.catch(() => {}); // only observed through the race below
  const timer = setTimeout(abort, Math.min(attemptTimeoutMs, budgetMs));

  let text;
  try {
    const response = await Promise.race([
      getClient().models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema,
          abortSignal: controller.signal,
        },
      }),
      aborted,
    ]);
    text = response.text;
  } catch (err) {
    throw err.kind ? err : attemptFailure(classifyApiError(err), err);
  } finally {
    clearTimeout(timer);
    deadlineSignal.removeEventListener('abort', abort);
  }

  try {
    return parse(JSON.parse(text));
  } catch (err) {
    // The message (validator or JSON.parse) is only logged, never sent to the client.
    throw attemptFailure('bad-output', err);
  }
}

/**
 * Runs a JSON-schema Gemini request with retries across the configured models.
 * `parse(json)` validates and cleans the parsed output; throwing from it counts as bad output.
 * Failures are HTTP-style errors: 503 busy, 502 bad output or config, 504 overall timeout.
 * Raw upstream messages are only logged, never put on the thrown error.
 */
export async function generateJson({
  prompt,
  responseSchema,
  parse,
  attemptTimeoutMs,
  totalTimeoutMs,
  messages,
  label = 'generation',
}) {
  const models = modelList();
  const startedAt = Date.now();
  const deadlineAt = startedAt + totalTimeoutMs;
  const deadline = new AbortController();
  const deadlineTimer = setTimeout(() => deadline.abort(), totalTimeoutMs);
  const deadlineHit = () => deadline.signal.aborted || Date.now() >= deadlineAt;

  const dead = new Set(); // models that failed with a config error
  let cursor = 0;
  let lastModel = null;
  let lastKind = 'busy';
  let attempts = 0;

  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const live = models.filter((m) => !dead.has(m));
      if (live.length === 0) break;
      const model = live[cursor % live.length];
      cursor++;

      if (model === lastModel) {
        const wait = BACKOFF_MS[Math.min(attempt - 2, BACKOFF_MS.length - 1)] + Math.random() * JITTER_MS;
        await sleep(wait, deadline.signal);
      }
      if (deadlineHit()) break;
      const remaining = deadlineAt - Date.now();
      if (remaining < MIN_REMAINING_MS) break;

      attempts = attempt;
      lastModel = model;
      const t0 = Date.now();
      try {
        const result = await attemptOnce(
          { model, prompt, responseSchema, parse, attemptTimeoutMs },
          deadline.signal,
          remaining,
        );
        if (attempt > 1) {
          console.info(`[${label}] attempt ${attempt}/${MAX_ATTEMPTS} model=${model} ok after ${Date.now() - t0}ms`);
        }
        return result;
      } catch (err) {
        lastKind = err.kind ?? 'busy';
        const took = `after ${Date.now() - t0}ms`;
        const head = `[${label}] attempt ${attempt}/${MAX_ATTEMPTS} model=${model} failed ${lastKind}`;
        const status = err.upstreamStatus ? ` (${err.upstreamStatus})` : '';
        if (deadlineHit()) break;
        if (lastKind === 'config') {
          dead.add(model);
          console.error(`${head}${status} ${took}: ${String(err.message).slice(0, 300)}`);
        } else {
          // For bad output, say why (it is our own validator's message); a busy message is upstream text.
          const reason = lastKind === 'bad-output' ? `: ${String(err.message).slice(0, 200)}` : '';
          console.warn(`${head}${status} ${took}${reason}`);
        }
      }
    }

    if (deadlineHit()) throw httpError(504, messages.timeout);
    console.error(`[${label}] giving up after ${attempts} attempt(s); last failure: ${lastKind}`);
    throw httpError(lastKind === 'busy' ? 503 : 502, lastKind === 'busy' ? messages.busy : messages.failed);
  } finally {
    clearTimeout(deadlineTimer);
    deadline.abort(); // stop anything still pending
  }
}
