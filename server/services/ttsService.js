import config from '../config/env.js';
import { generateSpeech } from './geminiClient.js';

// Step 2 of the Hinglish audio pipeline (Spec 6): script segments → chunks → Gemini TTS one chunk
// at a time → one PCM buffer (s16le mono) with short silences between chunks.

export const CHUNK_CHAR_CAP = 1_800;
export const MAX_CHUNKS = 4;
export const GAP_MS = 400;
export const WORDS_PER_SECOND = 2.3;
export const DURATION_RATIO = { min: 0.5, max: 2.0 };
export const TOTAL_SECONDS = { min: 30, max: 300 };

// Sent as a speech_metadata style annotation, so it shapes delivery and is never spoken.
export const TEACHER_STYLE =
  'Hinglish, like a warm, patient Indian teacher explaining to one student. Conversational, moderate pace, ' +
  'short natural pauses between sentences. English technical terms pronounced clearly in an Indian English accent.';

const countWords = (text) => text.split(/\s+/).filter(Boolean).length;

export const expectedSeconds = (text) => countWords(text) / WORDS_PER_SECOND;

export const pcmSeconds = (pcm, sampleRate) => pcm.length / 2 / sampleRate;

// Splits text over `cap` characters at sentence ends (falls back to word boundaries).
function splitLong(text, cap) {
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [text];
  const pieces = [];
  let current = '';
  const push = () => {
    if (current.trim()) pieces.push(current.trim());
    current = '';
  };
  for (const sentence of sentences) {
    if (sentence.length > cap) {
      push();
      let rest = sentence.trim();
      while (rest.length > cap) {
        const cut = rest.lastIndexOf(' ', cap);
        const at = cut > 0 ? cut : cap;
        pieces.push(rest.slice(0, at).trim());
        rest = rest.slice(at).trim();
      }
      current = rest ? `${rest} ` : '';
    } else if (current.length + sentence.length > cap) {
      push();
      current = sentence;
    } else {
      current += sentence;
    }
  }
  push();
  return pieces;
}

/** Groups consecutive segments into chunks of at most `cap` characters, never splitting a segment
 * unless that one segment is longer than `cap`. */
export function chunkSegments(segments, cap = CHUNK_CHAR_CAP) {
  const chunks = [];
  let current = '';
  for (const segment of segments) {
    const text = segment.trim();
    if (!text) continue;
    if (text.length > cap) {
      if (current) chunks.push(current);
      current = '';
      chunks.push(...splitLong(text, cap));
      continue;
    }
    if (current && current.length + 1 + text.length > cap) {
      chunks.push(current);
      current = text;
    } else {
      current = current ? `${current} ${text}` : text;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/** Joins PCM buffers (s16le mono) with `gapMs` of silence between them. */
export function stitchPcm(buffers, sampleRate, gapMs = GAP_MS) {
  if (buffers.length === 0) return Buffer.alloc(0);
  const gap = Buffer.alloc(Math.round((sampleRate * gapMs) / 1000) * 2); // zeros = silence
  const parts = [];
  buffers.forEach((buffer, i) => {
    if (i > 0) parts.push(gap);
    parts.push(buffer);
  });
  return Buffer.concat(parts);
}

// Rejects truncated or runaway audio for one chunk (retried by generateSpeech).
export function checkChunkDuration(text, seconds) {
  const expected = expectedSeconds(text);
  if (seconds < expected * DURATION_RATIO.min || seconds > expected * DURATION_RATIO.max) {
    throw new Error(`chunk is ${seconds.toFixed(1)}s, expected about ${expected.toFixed(1)}s`);
  }
}

const badOutput = (message) => Object.assign(new Error(message), { status: 502 });

/**
 * Speaks the script. Resolves to { pcm, sampleRate, durationSec, chunks, model }.
 * `signal` is the job deadline. Throws errors with `status` 503 / 502 / 504.
 */
export async function synthesize(segments, { signal, voice = config.ttsVoice } = {}) {
  const chunks = chunkSegments(segments);
  if (chunks.length === 0) throw badOutput('empty script');
  if (chunks.length > MAX_CHUNKS) throw badOutput(`script needs ${chunks.length} chunks, max ${MAX_CHUNKS}`);

  const buffers = [];
  let sampleRate = null;
  let model = null;
  for (const [i, text] of chunks.entries()) {
    // One after another: keeps within TTS rate limits and the voice consistent.
    const result = await generateSpeech({
      text,
      style: TEACHER_STYLE,
      voice,
      signal,
      label: `tts ${i + 1}/${chunks.length}`,
      check: ({ pcm, sampleRate: rate }) => checkChunkDuration(text, pcmSeconds(pcm, rate)),
    });
    if (sampleRate !== null && result.sampleRate !== sampleRate) {
      throw badOutput(`chunk sample rates differ (${sampleRate} vs ${result.sampleRate})`);
    }
    sampleRate = result.sampleRate;
    model = result.model;
    buffers.push(result.pcm);
  }

  const pcm = stitchPcm(buffers, sampleRate);
  const seconds = pcmSeconds(pcm, sampleRate);
  if (seconds < TOTAL_SECONDS.min || seconds > TOTAL_SECONDS.max) {
    throw badOutput(`audio is ${Math.round(seconds)}s, allowed ${TOTAL_SECONDS.min}-${TOTAL_SECONDS.max}s`);
  }
  return { pcm, sampleRate, durationSec: Math.round(seconds), chunks: chunks.length, model };
}
