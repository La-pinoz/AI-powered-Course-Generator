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
  onSuccess, // optional ({ model, attempts }) => void, e.g. to record which model answered
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
        onSuccess?.({ model, attempts: attempt });
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

// ---------------------------------------------------------------------------------------------
// Text-to-speech (Hinglish audio, Spec 6). Uses the Interactions API, which is what the Gemini TTS
// models are documented with. Same failure classification and backoff as generateJson.

const TTS_SAMPLE_RATE = 24_000;

const ttsModelList = () => [...new Set([config.ttsModel, config.ttsFallbackModel].filter(Boolean))];

// "audio/l16;rate=24000" or a separate sample_rate field; defaults to 24 kHz.
const sampleRateOf = (audio) => {
  if (Number.isInteger(audio?.sample_rate) && audio.sample_rate > 0) return audio.sample_rate;
  const match = /rate=(\d+)/i.exec(audio?.mime_type ?? '');
  return match ? Number(match[1]) : TTS_SAMPLE_RATE;
};

async function speechAttemptOnce({ model, text, style, voice, attemptTimeoutMs, check }, deadlineSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  deadlineSignal?.addEventListener('abort', abort, { once: true });
  const aborted = new Promise((_, reject) => {
    controller.signal.addEventListener('abort', () => reject(attemptFailure('busy')), { once: true });
  });
  aborted.catch(() => {});
  const timer = setTimeout(abort, attemptTimeoutMs);

  let audio;
  try {
    const interaction = await Promise.race([
      getClient().interactions.create(
        {
          model,
          input: [
            {
              type: 'user_input',
              content: [{ type: 'text', text, annotations: [{ type: 'speech_metadata', style }] }],
            },
          ],
          response_format: { type: 'audio', mime_type: 'audio/l16', sample_rate: TTS_SAMPLE_RATE },
          generation_config: { speech_config: [{ voice }] },
        },
        { signal: controller.signal },
      ),
      aborted,
    ]);
    audio = interaction?.output_audio;
  } catch (err) {
    throw err.kind ? err : attemptFailure(classifyApiError(err), err);
  } finally {
    clearTimeout(timer);
    deadlineSignal?.removeEventListener('abort', abort);
  }

  try {
    if (!audio?.data) throw new Error('no audio in the response');
    let pcm = Buffer.from(audio.data, 'base64');
    // A WAV container (if the API ignored the l16 request) starts with a 44-byte RIFF header.
    if (pcm.subarray(0, 4).toString('ascii') === 'RIFF') pcm = pcm.subarray(44);
    if (pcm.length < 2) throw new Error('empty audio');
    if (pcm.length % 2 === 1) pcm = pcm.subarray(0, pcm.length - 1);
    const result = { pcm, sampleRate: sampleRateOf(audio), model };
    check?.(result); // e.g. the duration check; throwing counts as bad output and is retried
    return result;
  } catch (err) {
    throw attemptFailure('bad-output', err);
  }
}

/**
 * Speaks `text` with a prebuilt voice and a style instruction (sent as a speech_metadata annotation,
 * so it is never read aloud). Resolves to { pcm: Buffer (s16le mono), sampleRate, model }.
 * Up to `maxAttempts` attempts across GEMINI_TTS_MODEL then GEMINI_TTS_FALLBACK_MODEL.
 * `signal` is the caller's overall deadline. Throws an error with `status` 503 busy, 502 failed or
 * 504 timeout (when `signal` aborted); upstream messages are only logged.
 */
export async function generateSpeech({
  text,
  style,
  voice,
  attemptTimeoutMs = 90_000,
  maxAttempts = 2,
  signal,
  check,
  label = 'tts',
}) {
  const models = ttsModelList();
  const dead = new Set();
  let cursor = 0;
  let lastModel = null;
  let lastKind = 'busy';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const live = models.filter((m) => !dead.has(m));
    if (live.length === 0) break;
    const model = live[cursor % live.length];
    cursor++;

    if (model === lastModel) {
      const wait = BACKOFF_MS[Math.min(attempt - 2, BACKOFF_MS.length - 1)] + Math.random() * JITTER_MS;
      await sleep(wait, signal ?? new AbortController().signal);
    }
    if (signal?.aborted) break;

    lastModel = model;
    const t0 = Date.now();
    try {
      return await speechAttemptOnce({ model, text, style, voice, attemptTimeoutMs, check }, signal);
    } catch (err) {
      lastKind = err.kind ?? 'busy';
      if (signal?.aborted) break;
      const head = `[${label}] attempt ${attempt}/${maxAttempts} model=${model} failed ${lastKind}`;
      const status = err.upstreamStatus ? ` (${err.upstreamStatus})` : '';
      const took = `after ${Date.now() - t0}ms`;
      if (lastKind === 'config') {
        dead.add(model);
        console.error(`${head}${status} ${took}: ${String(err.message).slice(0, 300)}`);
      } else {
        const reason = lastKind === 'bad-output' ? `: ${String(err.message).slice(0, 200)}` : '';
        console.warn(`${head}${status} ${took}${reason}`);
      }
    }
  }

  if (signal?.aborted) throw httpError(504, 'timeout');
  console.error(`[${label}] giving up; last failure: ${lastKind}`);
  throw httpError(lastKind === 'busy' ? 503 : 502, lastKind === 'busy' ? 'busy' : 'failed');
}
