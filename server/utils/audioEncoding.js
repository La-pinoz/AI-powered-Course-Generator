import { Mp3Encoder } from '@breezystack/lamejs';
import { Worker } from 'node:worker_threads';

// PCM (signed 16-bit little-endian, mono) → MP3, in pure JS (no ffmpeg). 64 kbps CBR is plenty for
// speech and keeps a 3-minute lesson around 1.4 MB.

export const MP3_KBPS = 64;
const FRAME_SAMPLES = 1152;

export function pcmToMp3(pcm, sampleRate, kbps = MP3_KBPS) {
  // Copy into an aligned Int16Array (a Buffer slice may start at an odd byte offset).
  const samples = new Int16Array(Math.floor(pcm.length / 2));
  for (let i = 0; i < samples.length; i++) samples[i] = pcm.readInt16LE(i * 2);

  const encoder = new Mp3Encoder(1, sampleRate, kbps);
  const parts = [];
  for (let i = 0; i < samples.length; i += FRAME_SAMPLES) {
    const frame = encoder.encodeBuffer(samples.subarray(i, i + FRAME_SAMPLES));
    if (frame.length) parts.push(Buffer.from(frame)); // copies: the encoder may reuse its buffer
  }
  const tail = encoder.flush();
  if (tail.length) parts.push(Buffer.from(tail));

  return { mp3: Buffer.concat(parts), durationSec: Math.round(samples.length / sampleRate) };
}

/**
 * pcmToMp3 in a worker thread, so the encode doesn't block the event loop.
 * Resolves to { mp3: Buffer, durationSec }.
 */
export function encodeMp3(pcm, sampleRate) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./mp3Worker.js', import.meta.url), {
      workerData: { pcm: new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength), sampleRate },
      execArgv: [], // don't inherit loader flags from the parent (test runners, --eval)
    });
    worker.once('message', ({ mp3, durationSec }) => {
      resolve({ mp3: Buffer.from(mp3.buffer, mp3.byteOffset, mp3.byteLength), durationSec });
    });
    worker.once('error', reject);
    worker.once('exit', (code) => {
      if (code !== 0) reject(new Error(`MP3 worker exited with code ${code}`));
    });
  });
}
