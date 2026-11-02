import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { UnauthorizedError } from 'express-oauth2-jwt-bearer';

// Small limits so the limit and deadline paths are quick to reach. Set before config is imported.
process.env.AUDIO_DAILY_LIMIT_PER_USER = '3';
process.env.AUDIO_TOTAL_TIMEOUT_MS = '8000';

vi.mock('../middlewares/checkJwt.js', () => ({
  default: (req, res, next) => {
    const sub = req.get('x-test-sub');
    if (!sub) return next(new UnauthorizedError('Unauthorized'));
    req.auth = { payload: { sub }, token: 'test-token' };
    return next();
  },
}));

vi.mock('../services/lessonQueue.js', () => ({
  ensureQueued: vi.fn(() => Promise.resolve()),
  prioritize: vi.fn(),
  cancelCourse: vi.fn(),
}));

// The Gemini boundary: script (generateJson) and speech (generateSpeech).
vi.mock('../services/geminiClient.js', () => ({
  generateJson: vi.fn(),
  generateSpeech: vi.fn(),
}));

// Encoding ~100 s of audio per job is slow and covered in tts.test.js; here only the first second is
// encoded (still a real MP3 stream), with the real duration reported.
vi.mock('../utils/audioEncoding.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    encodeMp3: async (pcm, sampleRate) => ({
      mp3: actual.pcmToMp3(pcm.subarray(0, sampleRate * 2), sampleRate).mp3,
      durationSec: Math.round(pcm.length / 2 / sampleRate),
    }),
  };
});

const { default: app } = await import('../app.js');
const gemini = await import('../services/geminiClient.js');
const audioJobs = await import('../services/audioJobs.js');
const audioService = await import('../services/audioService.js');
const audioStorage = await import('../services/audioStorage.js');
const { expectedSeconds } = await import('../services/ttsService.js');
const { sourceHashOf } = await import('../services/audioSource.js');
const { default: Course } = await import('../models/Course.js');
const { default: Module } = await import('../models/Module.js');
const { default: Lesson } = await import('../models/Lesson.js');

const ALICE = 'auth0|alice';
const BOB = 'auth0|bob';

const as = (sub) => ({
  get: (url) => request(app).get(url).set('x-test-sub', sub),
  post: (url) => request(app).post(url).set('x-test-sub', sub),
  delete: (url) => request(app).delete(url).set('x-test-sub', sub),
});

const QUESTION = 'What separates an agent from a chatbot in practice?';
const content = [
  { type: 'heading', text: 'The agent loop' },
  { type: 'paragraph', text: 'An **AI agent** works toward a **goal** and can use a `tool`.' },
  { type: 'example', title: 'Travel agent', text: 'It books a flight to Goa.' },
  { type: 'mcq', question: QUESTION, options: ['A', 'B', 'C', 'D'], answer: 1, explanation: 'Because.' },
];

const filler =
  'Dekho, simple si baat hai. Ek AI agent apne goal ki taraf kaam karta hai. Woh pehle dekhta hai, phir sochta hai, ' +
  'aur phir action leta hai. Toh iska matlab kya hua? Matlab yeh ki agent sirf jawab nahi deta, woh kaam karta hai. ' +
  'Ab socho, ek tool use karke woh flight book kar sakta hai.';
const goodScript = { segments: [filler, filler, filler, filler].map((text) => ({ text })) };

// Behaves like the real generateJson: runs the parser on the model output and reports the model.
const scriptOk = async ({ parse, onSuccess }) => {
  const result = parse(structuredClone(goodScript));
  onSuccess?.({ model: 'script-model', attempts: 1 });
  return result;
};
const busy = () => Promise.reject(Object.assign(new Error('busy'), { status: 503 }));

// A fake TTS that returns silence of the right length (and runs the duration check).
const speechOk = async ({ text, check }) => {
  const result = {
    pcm: Buffer.alloc(Math.round(expectedSeconds(text) * 24_000) * 2),
    sampleRate: 24_000,
    model: 'tts-model',
  };
  check?.(result);
  return result;
};

async function seedCourse({ creator = ALICE, hinglishAudio = true, lessonStatus = 'ready', audio = null } = {}) {
  const courseId = new mongoose.Types.ObjectId();
  const moduleId = new mongoose.Types.ObjectId();
  const lessonId = new mongoose.Types.ObjectId();
  await Course.create({
    _id: courseId,
    creator,
    topic: 'Topic',
    title: 'Intro to Agentic AI',
    depth: 'quick',
    moduleCount: 1,
    lessonCount: 1,
    modules: [moduleId],
    options: { sideQuest: false, hinglishAudio },
  });
  await Module.create({ _id: moduleId, course: courseId, title: 'Foundations', order: 1, lessons: [lessonId] });
  await Lesson.create({
    _id: lessonId,
    course: courseId,
    module: moduleId,
    title: 'What are AI Agents',
    order: 2,
    objectives: ['Define an agent'],
    status: lessonStatus,
    content: lessonStatus === 'ready' ? content : [],
    summary: lessonStatus === 'ready' ? 'An agent acts.' : undefined,
    audio,
  });
  return { courseId: String(courseId), moduleId: String(moduleId), lessonId: String(lessonId) };
}

const audioUrl = ({ courseId, lessonId }, suffix = '') => `/api/courses/${courseId}/lessons/${lessonId}/audio${suffix}`;

const filesCollection = () => mongoose.connection.db.collection('lessonAudio.files');

async function makeReady(ids) {
  const res = await as(ALICE).post(audioUrl(ids));
  expect(res.status).toBe(202);
  await audioJobs.whenIdle();
  const lesson = await Lesson.findById(ids.lessonId).lean();
  expect(lesson.audio.status).toBe('ready');
  return lesson;
}

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(() => {
  gemini.generateJson.mockReset().mockImplementation(scriptOk);
  gemini.generateSpeech.mockReset().mockImplementation(speechOk);
  audioService._resetForTests();
});

afterEach(async () => {
  await audioJobs.whenIdle();
  audioJobs._resetForTests();
  await Promise.all([
    Course.deleteMany({}),
    Module.deleteMany({}),
    Lesson.deleteMany({}),
    filesCollection().deleteMany({}),
    mongoose.connection.db.collection('lessonAudio.chunks').deleteMany({}),
  ]);
});

describe('GET /audio', () => {
  it("is 'none' before anything was made", async () => {
    const ids = await seedCourse();
    const res = await as(ALICE).get(audioUrl(ids));
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toEqual({ status: 'none', stage: null, error: null });
    expect(gemini.generateJson).not.toHaveBeenCalled();
  });

  it('reports the stage while generating', async () => {
    const ids = await seedCourse({ audio: { status: 'generating', stage: 'voice', startedAt: new Date() } });
    const res = await as(ALICE).get(audioUrl(ids));
    expect(res.body).toEqual({ status: 'generating', stage: 'voice', error: null });
  });
});

describe('POST /audio: the pipeline and the cache', () => {
  it('makes the audio once; later POSTs and file GETs never call Gemini again', async () => {
    const ids = await seedCourse();
    const first = await as(ALICE).post(audioUrl(ids));
    expect(first.status).toBe(202);
    expect(first.body).toEqual({ status: 'generating', stage: 'script' });
    await audioJobs.whenIdle();

    const status = await as(ALICE).get(audioUrl(ids));
    expect(status.body.status).toBe('ready');
    expect(status.body.script).toHaveLength(4);
    expect(status.body.voice).toBe('Sulafat');
    expect(status.body.durationSec).toBeGreaterThan(60);
    expect(status.body.durationSec).toBeLessThan(200);
    for (const key of ['fileId', 'sourceHash', 'attempts', 'lastError', 'scriptModel', 'ttsModel', 'errorKind']) {
      expect(status.body).not.toHaveProperty(key);
    }

    const scriptCalls = gemini.generateJson.mock.calls.length;
    const speechCalls = gemini.generateSpeech.mock.calls.length;
    expect(scriptCalls).toBe(1);
    expect(speechCalls).toBeGreaterThanOrEqual(1);

    const again = await as(ALICE).post(audioUrl(ids));
    expect(again.status).toBe(200);
    expect(again.body.status).toBe('ready');
    await as(ALICE).get(audioUrl(ids, '/file'));
    await as(ALICE).get(audioUrl(ids, '/file'));

    expect(gemini.generateJson).toHaveBeenCalledTimes(scriptCalls);
    expect(gemini.generateSpeech).toHaveBeenCalledTimes(speechCalls);

    const stored = await Lesson.findById(ids.lessonId).lean();
    expect(stored.audio).toMatchObject({ scriptModel: 'script-model', ttsModel: 'tts-model', pipelineVersion: 1 });
    expect(stored.audio.sourceHash).toBe(sourceHashOf(stored));
  });

  it('never sends quiz content to the script model', async () => {
    const ids = await seedCourse();
    await makeReady(ids);
    const [{ prompt, parse }] = gemini.generateJson.mock.calls[0];
    expect(prompt).not.toContain(QUESTION);
    // The validator also refuses a script that repeats a quiz question.
    const leaky = { segments: [...goodScript.segments.slice(0, 3), { text: `${filler} ${QUESTION}` }] };
    expect(() => parse(leaky)).toThrow(/quiz question/);
  });

  it('starts exactly one job for two parallel POSTs', async () => {
    const ids = await seedCourse();
    const [a, b] = await Promise.all([as(ALICE).post(audioUrl(ids)), as(ALICE).post(audioUrl(ids))]);
    expect([a.status, b.status]).toEqual([202, 202]);
    await audioJobs.whenIdle();
    expect(gemini.generateJson).toHaveBeenCalledTimes(1);
  });

  it('is 409 when the lesson is not ready or the course has Hinglish off', async () => {
    const pending = await seedCourse({ lessonStatus: 'pending' });
    const off = await seedCourse({ hinglishAudio: false });
    const a = await as(ALICE).post(audioUrl(pending));
    const b = await as(ALICE).post(audioUrl(off));
    expect(a.status).toBe(409);
    expect(a.body).toEqual({ message: "This lesson isn't ready yet." });
    expect(b.status).toBe(409);
    expect(b.body).toEqual({ message: 'Hinglish audio is off for this course.' });
    expect(gemini.generateJson).not.toHaveBeenCalled();
  });

  it('is 429 after the daily limit, while cached audio still answers 200', async () => {
    gemini.generateJson.mockImplementation(busy);
    const ids = await seedCourse();
    for (let i = 0; i < 3; i++) {
      expect((await as(ALICE).post(audioUrl(ids))).status).toBe(202);
      await audioJobs.whenIdle(); // fails fast, so the next POST is a retry
    }
    const limited = await as(ALICE).post(audioUrl(ids));
    expect(limited.status).toBe(429);
    expect(limited.body.message).toMatch(/today's limit/);

    const lesson = { title: 'What are AI Agents', objectives: ['Define an agent'], summary: 'An agent acts.', content };
    const cached = await seedCourse({
      audio: { status: 'ready', sourceHash: sourceHashOf(lesson), script: ['x'], durationSec: 90, voice: 'Sulafat' },
    });
    const ok = await as(ALICE).post(audioUrl(cached));
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('ready');

    // Another user has their own count.
    const bobs = await seedCourse({ creator: BOB });
    expect((await as(BOB).post(audioUrl(bobs))).status).toBe(202);
  });

  it('is 404 for another user, a lesson from another course and a malformed id', async () => {
    const ids = await seedCourse();
    const other = await seedCourse();
    const cases = [
      as(BOB).post(audioUrl(ids)),
      as(BOB).get(audioUrl(ids)),
      as(BOB).get(audioUrl(ids, '/file')),
      as(ALICE).post(audioUrl({ courseId: other.courseId, lessonId: ids.lessonId })),
      as(ALICE).get(`/api/courses/${ids.courseId}/lessons/not-an-id/audio`),
    ];
    for (const res of await Promise.all(cases)) expect(res.status).toBe(404);
  });
});

describe('GET /audio/file', () => {
  it('streams the MP3 with the right headers', async () => {
    const ids = await seedCourse();
    await makeReady(ids);

    const res = await as(ALICE).get(audioUrl(ids, '/file')).buffer(true).parse((r, cb) => {
      const chunks = [];
      r.on('data', (c) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('audio/mpeg');
    expect(Number(res.headers['content-length'])).toBe(res.body.length);
    expect(res.headers['content-disposition']).toMatch(/^inline/);
    expect(res.body[0]).toBe(0xff);

    const download = await as(ALICE).get(audioUrl(ids, '/file?download=1'));
    expect(download.headers['content-disposition']).toBe('attachment; filename="intro-to-agentic-ai-m1-l2-hinglish.mp3"');

    const revalidate = await as(ALICE).get(audioUrl(ids, '/file')).set('If-None-Match', res.headers.etag);
    expect(revalidate.status).toBe(304);
  });

  it('is 404 when not ready', async () => {
    const ids = await seedCourse();
    const res = await as(ALICE).get(audioUrl(ids, '/file'));
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Audio not found.' });
  });
});

describe('outdated audio', () => {
  it("reports changed content as 'none' + outdated and stops serving the old file", async () => {
    const ids = await seedCourse();
    await makeReady(ids);
    await Lesson.updateOne({ _id: ids.lessonId }, { $set: { 'content.1.text': 'A changed paragraph about **AI agent** goals.' } });

    const status = await as(ALICE).get(audioUrl(ids));
    expect(status.body).toEqual({ status: 'none', stage: null, outdated: true, error: null });
    expect((await as(ALICE).get(audioUrl(ids, '/file'))).status).toBe(404);
  });

  it('keeps the old file when a regeneration fails, and replaces it when one succeeds', async () => {
    const ids = await seedCourse();
    const first = await makeReady(ids);
    await Lesson.updateOne({ _id: ids.lessonId }, { $set: { 'content.1.text': 'Changed **AI agent** text with a `tool`.' } });

    gemini.generateJson.mockImplementation(busy);
    expect((await as(ALICE).post(audioUrl(ids))).status).toBe(202);
    await audioJobs.whenIdle();
    expect(await audioStorage.fileInfo(first.audio.fileId)).not.toBeNull();

    gemini.generateJson.mockImplementation(scriptOk);
    const second = await makeReady(ids);
    expect(String(second.audio.fileId)).not.toBe(String(first.audio.fileId));
    expect(await audioStorage.fileInfo(first.audio.fileId)).toBeNull();
    expect(await filesCollection().countDocuments()).toBe(1);
  });
});

describe('failures', () => {
  it('marks a busy script step failed with the safe message, never the raw error', async () => {
    gemini.generateJson.mockImplementation(busy);
    const ids = await seedCourse();
    await as(ALICE).post(audioUrl(ids));
    await audioJobs.whenIdle();

    const res = await as(ALICE).get(audioUrl(ids));
    expect(res.body).toEqual({
      status: 'failed',
      stage: null,
      error: 'The audio service is busy right now. Please try again in a minute.',
    });
    // Try again works from the failed state.
    gemini.generateJson.mockImplementation(scriptOk);
    await makeReady(ids);
  });

  it('marks bad TTS output failed', async () => {
    gemini.generateSpeech.mockImplementation(() => Promise.reject(Object.assign(new Error('failed'), { status: 502 })));
    const ids = await seedCourse();
    await as(ALICE).post(audioUrl(ids));
    await audioJobs.whenIdle();
    const res = await as(ALICE).get(audioUrl(ids));
    expect(res.body.error).toBe("We couldn't make the audio this time. Please try again.");
    expect(await filesCollection().countDocuments()).toBe(0);
  });

  it('fails a lesson with nothing to explain without calling Gemini', async () => {
    const ids = await seedCourse();
    await Lesson.updateOne({ _id: ids.lessonId }, { $set: { content: [content[3]], summary: '' } });
    await as(ALICE).post(audioUrl(ids));
    await audioJobs.whenIdle();
    const res = await as(ALICE).get(audioUrl(ids));
    expect(res.body.error).toBe('This lesson has nothing to explain in audio.');
    expect(gemini.generateJson).not.toHaveBeenCalled();
  });

  it('marks the job failed when it passes its deadline', async () => {
    gemini.generateSpeech.mockImplementation(
      ({ signal }) =>
        new Promise((_, reject) => {
          signal.addEventListener('abort', () => reject(Object.assign(new Error('timeout'), { status: 504 })));
        }),
    );
    const ids = await seedCourse();
    await as(ALICE).post(audioUrl(ids));
    await audioJobs.whenIdle();
    const res = await as(ALICE).get(audioUrl(ids));
    expect(res.body.error).toBe('Making the audio took too long. Please try again.');
  }, 20_000);
});

describe('recovery and cleanup', () => {
  const longAgo = () => new Date(Date.now() - 60 * 60 * 1000);

  it('turns an interrupted job into failed (boot scan and per-lesson check)', async () => {
    const a = await seedCourse({ audio: { status: 'generating', stage: 'voice', startedAt: longAgo() } });
    const b = await seedCourse({ audio: { status: 'generating', stage: 'script', startedAt: longAgo() } });

    await audioJobs.recoverStaleAudio();
    expect((await Lesson.findById(a.lessonId).lean()).audio.status).toBe('failed');

    await Lesson.updateOne({ _id: b.lessonId }, { $set: { 'audio.status': 'generating' } });
    const res = await as(ALICE).get(audioUrl(b));
    expect(res.body.status).toBe('failed');
  });

  it('deleting a course removes its audio files', async () => {
    const ids = await seedCourse();
    const keep = await seedCourse();
    await makeReady(ids);
    await makeReady(keep);
    expect(await filesCollection().countDocuments()).toBe(2);

    expect((await as(ALICE).delete(`/api/courses/${ids.courseId}`)).status).toBe(204);
    expect(await filesCollection().countDocuments({ 'metadata.courseId': new mongoose.Types.ObjectId(ids.courseId) })).toBe(0);
    expect(await filesCollection().countDocuments()).toBe(1);
  });

  it('a job that finishes after its lesson was deleted leaves no file behind', async () => {
    const ids = await seedCourse();
    gemini.generateSpeech.mockImplementation(async (args) => {
      await Lesson.deleteOne({ _id: ids.lessonId });
      return speechOk(args);
    });
    await as(ALICE).post(audioUrl(ids));
    await audioJobs.whenIdle();
    expect(await filesCollection().countDocuments()).toBe(0);
  });

  it('the boot sweep removes files no lesson points at', async () => {
    const ids = await seedCourse();
    await makeReady(ids);
    await audioStorage.saveFile(Buffer.from([1, 2, 3]), {
      lessonId: new mongoose.Types.ObjectId(),
      courseId: new mongoose.Types.ObjectId(),
      creator: ALICE,
      sourceHash: 'x',
    });
    expect(await audioStorage.sweepOrphans({ graceMs: -1000 })).toBe(1);
    expect(await filesCollection().countDocuments()).toBe(1);
  });
});
