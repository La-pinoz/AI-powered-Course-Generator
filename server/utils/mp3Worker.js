import { parentPort, workerData } from 'node:worker_threads';
import { pcmToMp3 } from './audioEncoding.js';

// Runs the CPU-heavy MP3 encode off the main thread (about 2 s for a 150 s lesson), so the API keeps
// answering requests meanwhile. Started by encodeMp3() in audioEncoding.js.
const { pcm, sampleRate } = workerData;
const { mp3, durationSec } = pcmToMp3(Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength), sampleRate);
parentPort.postMessage({ mp3, durationSec });
