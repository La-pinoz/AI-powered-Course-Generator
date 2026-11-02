import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { UnauthorizedError } from 'express-oauth2-jwt-bearer';

// Stand-in for Auth0 JWT validation: the `x-test-sub` header becomes the token's `sub`.
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

const { default: app } = await import('../app.js');
const lessonQueue = await import('../services/lessonQueue.js');
const { default: Course } = await import('../models/Course.js');
const { default: Module } = await import('../models/Module.js');
const { default: Lesson } = await import('../models/Lesson.js');

const ALICE = 'auth0|alice';
const BOB = 'auth0|bob';

const as = (sub) => ({
  get: (url) => request(app).get(url).set('x-test-sub', sub),
  post: (url) => request(app).post(url).set('x-test-sub', sub),
});

const blocks = [
  { type: 'paragraph', text: 'Hello **world**' },
  { type: 'example', title: 'Ex', text: 'Example text' },
];

async function seedCourse(creator = ALICE) {
  const courseId = new mongoose.Types.ObjectId();
  const moduleId = new mongoose.Types.ObjectId();
  const lessonId = new mongoose.Types.ObjectId();
  await Course.create({
    _id: courseId,
    creator,
    topic: 'Topic',
    title: 'Course',
    depth: 'quick',
    moduleCount: 1,
    lessonCount: 1,
    modules: [moduleId],
  });
  await Module.create({ _id: moduleId, course: courseId, title: 'Foundations', order: 1, lessons: [lessonId] });
  await Lesson.create({
    _id: lessonId,
    course: courseId,
    module: moduleId,
    title: 'What are AI Agents',
    order: 1,
    objectives: ['Define an agent'],
  });
  return { courseId: String(courseId), moduleId: String(moduleId), lessonId: String(lessonId) };
}

const urlFor = ({ courseId, lessonId }, suffix = '') => `/api/courses/${courseId}/lessons/${lessonId}${suffix}`;

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
  lessonQueue.ensureQueued.mockClear();
  lessonQueue.prioritize.mockClear();
});

afterEach(async () => {
  await Promise.all([Course.deleteMany({}), Module.deleteMany({}), Lesson.deleteMany({})]);
});

describe('GET /api/courses/:courseId/lessons/:lessonId', () => {
  it('returns the lesson without content while it is pending, and queues it', async () => {
    const ids = await seedCourse();
    const res = await as(ALICE).get(urlFor(ids));

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toEqual({
      id: ids.lessonId,
      courseId: ids.courseId,
      moduleId: ids.moduleId,
      moduleTitle: 'Foundations',
      moduleOrder: 1,
      title: 'What are AI Agents',
      order: 1,
      objectives: ['Define an agent'],
      status: 'pending',
    });
    expect(lessonQueue.ensureQueued).toHaveBeenCalledWith(ids.courseId);
    expect(lessonQueue.prioritize).toHaveBeenCalledWith(ids.courseId, ids.lessonId);
  });

  it('does not prioritize or include content while generating', async () => {
    const ids = await seedCourse();
    await Lesson.updateOne({ _id: ids.lessonId }, { status: 'generating' });
    const res = await as(ALICE).get(urlFor(ids));
    expect(res.body.status).toBe('generating');
    expect(res.body).not.toHaveProperty('content');
    expect(res.body).not.toHaveProperty('summary');
    expect(lessonQueue.prioritize).not.toHaveBeenCalled();
  });

  it('includes content and summary when ready, and never leaks server-only fields', async () => {
    const ids = await seedCourse();
    await Lesson.updateOne(
      { _id: ids.lessonId },
      {
        status: 'ready',
        isEnriched: true,
        content: blocks,
        summary: 'A recap.',
        videoQuery: 'agents explained',
        attempts: 2,
        lastError: 'SECRET upstream detail',
      },
    );
    const res = await as(ALICE).get(urlFor(ids));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ready', summary: 'A recap.', content: blocks });
    expect(lessonQueue.prioritize).not.toHaveBeenCalled();
    for (const field of ['lastError', 'videoQuery', 'attempts', 'audio']) {
      expect(res.body).not.toHaveProperty(field);
    }
    expect(JSON.stringify(res.body)).not.toContain('SECRET');
  });

  it('never leaks lastError on a failed lesson', async () => {
    const ids = await seedCourse();
    await Lesson.updateOne({ _id: ids.lessonId }, { status: 'failed', lastError: 'SECRET upstream detail' });
    const res = await as(ALICE).get(urlFor(ids));
    expect(res.body.status).toBe('failed');
    expect(JSON.stringify(res.body)).not.toContain('SECRET');
  });

  it('treats a lesson with no status (made before this feature) as pending', async () => {
    const ids = await seedCourse();
    await Lesson.collection.updateOne({ _id: new mongoose.Types.ObjectId(ids.lessonId) }, { $unset: { status: '' } });
    const res = await as(ALICE).get(urlFor(ids));
    expect(res.body.status).toBe('pending');
    expect(lessonQueue.prioritize).toHaveBeenCalled();
  });

  it("404 for another user's course", async () => {
    const ids = await seedCourse(ALICE);
    const res = await as(BOB).get(urlFor(ids));
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Course not found.' });
    expect(lessonQueue.ensureQueued).not.toHaveBeenCalled();
  });

  it('404 for a lesson that belongs to a different course', async () => {
    const mine = await seedCourse();
    const other = await seedCourse();
    const res = await as(ALICE).get(`/api/courses/${mine.courseId}/lessons/${other.lessonId}`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Lesson not found.' });
  });

  it('404 for malformed and unknown ids', async () => {
    const ids = await seedCourse();
    const badLesson = await as(ALICE).get(`/api/courses/${ids.courseId}/lessons/nope`);
    expect(badLesson.status).toBe(404);
    expect(badLesson.body).toEqual({ message: 'Lesson not found.' });

    const badCourse = await as(ALICE).get(`/api/courses/nope/lessons/${ids.lessonId}`);
    expect(badCourse.status).toBe(404);
    expect(badCourse.body).toEqual({ message: 'Course not found.' });

    const unknown = await as(ALICE).get(`/api/courses/${ids.courseId}/lessons/${new mongoose.Types.ObjectId()}`);
    expect(unknown.status).toBe(404);
  });
});

describe('POST /api/courses/:courseId/lessons/:lessonId/retry', () => {
  it('turns a failed lesson back into pending, clears the error and prioritizes it', async () => {
    const ids = await seedCourse();
    await Lesson.updateOne({ _id: ids.lessonId }, { status: 'failed', attempts: 3, lastError: 'boom' });

    const res = await as(ALICE).post(urlFor(ids, '/retry'));
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ status: 'pending' });

    const stored = await Lesson.findById(ids.lessonId).lean();
    expect(stored.status).toBe('pending');
    expect(stored.attempts).toBe(0);
    expect(stored.lastError).toBeUndefined();
    expect(lessonQueue.ensureQueued).toHaveBeenCalledWith(ids.courseId);
    expect(lessonQueue.prioritize).toHaveBeenCalledWith(ids.courseId, ids.lessonId);
  });

  it.each(['pending', 'generating'])('is a no-op 202 for a %s lesson', async (status) => {
    const ids = await seedCourse();
    await Lesson.updateOne({ _id: ids.lessonId }, { status });

    const res = await as(ALICE).post(urlFor(ids, '/retry'));
    expect(res.status).toBe(202);
    expect((await Lesson.findById(ids.lessonId).lean()).status).toBe(status);
    expect(lessonQueue.ensureQueued).not.toHaveBeenCalled();
  });

  it('409 for a ready lesson, which is never rewritten', async () => {
    const ids = await seedCourse();
    await Lesson.updateOne({ _id: ids.lessonId }, { status: 'ready', content: blocks });

    const res = await as(ALICE).post(urlFor(ids, '/retry'));
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ message: 'This lesson is already ready.' });
    expect((await Lesson.findById(ids.lessonId).lean()).content).toEqual(blocks);
  });

  it("404 for another user's course and for a malformed id", async () => {
    const ids = await seedCourse(ALICE);
    await Lesson.updateOne({ _id: ids.lessonId }, { status: 'failed' });

    const foreign = await as(BOB).post(urlFor(ids, '/retry'));
    expect(foreign.status).toBe(404);
    expect((await Lesson.findById(ids.lessonId).lean()).status).toBe('failed');

    const bad = await as(ALICE).post(`/api/courses/${ids.courseId}/lessons/nope/retry`);
    expect(bad.status).toBe(404);
  });
});
