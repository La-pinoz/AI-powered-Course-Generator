import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/geminiClient.js', () => ({
  generateSpeech: vi.fn(),
  generateJson: vi.fn(),
}));

const gemini = await import('../services/geminiClient.js');
const tts = await import('../services/ttsService.js');
const { pcmToMp3 } = await import('../utils/audioEncoding.js');

const RATE = 24_000;
const pcmFor = (seconds) => Buffer.alloc(Math.round(seconds * RATE) * 2, 1);
const words = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');

// A fake TTS: the right length for the text, unless `factor` says otherwise. Runs `check` like
// the real client does.
const fakeSpeech = (factor = 1) => async ({ text, check }) => {
  const result = { pcm: pcmFor(tts.expectedSeconds(text) * factor), sampleRate: RATE, model: 'tts-model' };
  check?.(result);
  return result;
};

beforeEach(() => {
  gemini.generateSpeech.mockReset();
});

describe('chunkSegments', () => {
  it('groups consecutive segments without splitting them', () => {
    const a = 'a'.repeat(900);
    const b = 'b'.repeat(800);
    const c = 'c'.repeat(500);
    expect(tts.chunkSegments([a, b, c], 1800)).toEqual([`${a} ${b}`, c]);
  });

  it('splits a segment longer than the cap at sentence ends', () => {
    const sentence = `${'x'.repeat(590)}. `;
    const chunks = tts.chunkSegments([sentence.repeat(4).trim()], 1800);
    expect(chunks.length).toBe(2);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(1800);
    expect(chunks.join(' ').replace(/\s+/g, ' ')).toBe(sentence.repeat(4).trim().replace(/\s+/g, ' '));
  });
});

describe('stitchPcm', () => {
  it('joins buffers with silence between them', () => {
    const out = tts.stitchPcm([Buffer.from([1, 0]), Buffer.from([2, 0])], RATE, 400);
    const gapBytes = 0.4 * RATE * 2;
    expect(out.length).toBe(4 + gapBytes);
    expect(out[0]).toBe(1);
    expect(out.subarray(2, 2 + gapBytes).every((byte) => byte === 0)).toBe(true);
    expect(out[2 + gapBytes]).toBe(2);
  });
});

describe('synthesize', () => {
  const segment = words(150); // ~65 s each

  it('speaks chunks in order and stitches them', async () => {
    gemini.generateSpeech.mockImplementation(fakeSpeech());
    const result = await tts.synthesize([segment, segment, segment]);
    const texts = gemini.generateSpeech.mock.calls.map(([args]) => args.text);
    expect(texts).toEqual(tts.chunkSegments([segment, segment, segment]));
    expect(gemini.generateSpeech.mock.calls[0][0].style).toBe(tts.TEACHER_STYLE);
    expect(result.chunks).toBe(texts.length);
    expect(result.durationSec).toBeGreaterThan(150);
    expect(result.model).toBe('tts-model');
  });

  it('passes a duration check that rejects truncated audio', async () => {
    gemini.generateSpeech.mockImplementation(fakeSpeech(0.3));
    await expect(tts.synthesize([segment])).rejects.toThrow(/expected about/);
  });

  it('rejects runaway audio', () => {
    expect(() => tts.checkChunkDuration(words(23), 25)).toThrow(/expected about/);
    expect(() => tts.checkChunkDuration(words(23), 10)).not.toThrow();
  });

  it('enforces the total-duration bounds', async () => {
    gemini.generateSpeech.mockImplementation(fakeSpeech());
    await expect(tts.synthesize([words(20)])).rejects.toMatchObject({ status: 502 });
  });

  it('rejects more than 4 chunks', async () => {
    gemini.generateSpeech.mockImplementation(fakeSpeech());
    const long = 'y'.repeat(1700);
    await expect(tts.synthesize([long, long, long, long, long])).rejects.toMatchObject({ status: 502 });
    expect(gemini.generateSpeech).not.toHaveBeenCalled();
  });

  it('passes the busy error through', async () => {
    gemini.generateSpeech.mockRejectedValue(Object.assign(new Error('busy'), { status: 503 }));
    await expect(tts.synthesize([segment])).rejects.toMatchObject({ status: 503 });
  });
});

describe('pcmToMp3', () => {
  it('produces MP3 frames and the duration', () => {
    const pcm = Buffer.alloc(RATE * 2 * 3);
    for (let i = 0; i < pcm.length / 2; i++) pcm.writeInt16LE(Math.round(Math.sin(i / 10) * 8000), i * 2);
    const { mp3, durationSec } = pcmToMp3(pcm, RATE);
    expect(durationSec).toBe(3);
    expect(mp3[0]).toBe(0xff);
    expect(mp3[1] & 0xe0).toBe(0xe0); // MPEG frame sync
    // 64 kbps for 3 s ≈ 24 KB.
    expect(mp3.length).toBeGreaterThan(20_000);
    expect(mp3.length).toBeLessThan(30_000);
  });
});
