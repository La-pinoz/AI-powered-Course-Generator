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

vi.mock('../services/courseGenerationService.js', () => ({
  generateCourseOutline: vi.fn(),
}));

const { default: app } = await import('../app.js');
const { generateCourseOutline } = await import('../services/courseGenerationService.js');
const { default: Course } = await import('../models/Course.js');
const { default: Module } = await import('../models/Module.js');
const { default: Lesson } = await import('../models/Lesson.js');

const ALICE = 'auth0|alice';
const BOB = 'auth0|bob';

const makeOutline = (modules = 4, lessonsPerModule = 3) => ({
  title: 'Intro to React Hooks',
  description: 'Learn hooks.',
  modules: Array.from({ length: modules }, (_, m) => ({
    title: `Module ${m + 1}`,
    lessons: Array.from({ length: lessonsPerModule }, (_, l) => ({
      title: `Lesson ${m + 1}.${l + 1}`,
      objectives: ['Understand it'],
    })),
  })),
});

const as = (sub) => ({
  get: (url) => request(app).get(url).set('x-test-sub', sub),
  post: (url) => request(app).post(url).set('x-test-sub', sub),
  patch: (url) => request(app).patch(url).set('x-test-sub', sub),
  delete: (url) => request(app).delete(url).set('x-test-sub', sub),
});

const validBody = { topic: 'Intro to React Hooks', depth: 'standard', sideQuest: false, hinglishAudio: true };

async function createFor(sub, body = validBody, outline = makeOutline()) {
  generateCourseOutline.mockResolvedValueOnce(outline);
  const res = await as(sub).post('/api/courses').send(body);
  expect(res.status).toBe(201);
  return res.body.course;
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
  generateCourseOutline.mockReset();
});

afterEach(async () => {
  await Promise.all([Course.deleteMany({}), Module.deleteMany({}), Lesson.deleteMany({})]);
});

describe('auth', () => {
  it.each([
    ['get', '/api/courses'],
    ['post', '/api/courses'],
    ['get', `/api/courses/${new mongoose.Types.ObjectId()}/outline`],
    ['delete', `/api/courses/${new mongoose.Types.ObjectId()}`],
    ['patch', `/api/courses/${new mongoose.Types.ObjectId()}/progress`],
  ])('%s %s returns 401 { message } without a token', async (method, url) => {
    const res = await request(app)[method](url);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Please log in again.' });
  });
});

describe('GET /api/courses', () => {
  it('returns an empty list and zero stats for a new user', async () => {
    const res = await as(ALICE).get('/api/courses');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      courses: [],
      stats: { courseCount: 0, lessonCount: 0, completedLessonCount: 0 },
    });
  });

  it("lists only the caller's courses, newest activity first, with stats", async () => {
    const first = await createFor(ALICE);
    const second = await createFor(ALICE, validBody, makeOutline(3, 4));
    await createFor(BOB);

    // Touch the first course so it becomes the most recent.
    const outline = await as(ALICE).get(`/api/courses/${first._id}/outline`);
    const lessonId = outline.body.course.modules[0].lessons[0]._id;
    await as(ALICE)
      .patch(`/api/courses/${first._id}/progress`)
      .send({ lessonId, completed: true });

    const res = await as(ALICE).get('/api/courses');
    expect(res.status).toBe(200);
    expect(res.body.courses.map((c) => c._id)).toEqual([first._id, second._id]);
    expect(res.body.courses[0]).toMatchObject({
      title: 'Intro to React Hooks',
      moduleCount: 4,
      lessonCount: 12,
      completedLessonCount: 1,
    });
    expect(res.body.stats).toEqual({ courseCount: 2, lessonCount: 24, completedLessonCount: 1 });
  });
});

describe('POST /api/courses', () => {
  it('creates a course, modules and lessons and sets the resume point', async () => {
    generateCourseOutline.mockResolvedValueOnce(makeOutline(4, 3));
    const res = await as(ALICE)
      .post('/api/courses')
      .send({ ...validBody, topic: '  Intro to React Hooks  ', extra: 'ignored' });

    expect(res.status).toBe(201);
    expect(generateCourseOutline).toHaveBeenCalledWith({
      topic: 'Intro to React Hooks',
      depth: 'standard',
      sideQuest: false,
      hinglishAudio: true,
    });

    const { course } = res.body;
    expect(course).toMatchObject({
      title: 'Intro to React Hooks',
      moduleCount: 4,
      lessonCount: 12,
      completedLessonCount: 0,
    });
    expect(course.currentLessonId).toBeTruthy();

    const stored = await Course.findById(course._id).lean();
    expect(stored.creator).toBe(ALICE);
    expect(stored.topic).toBe('Intro to React Hooks');
    expect(stored.options).toEqual({ sideQuest: false, hinglishAudio: true });
    expect(stored.modules).toHaveLength(4);

    const lessons = await Lesson.find({ course: course._id }).lean();
    expect(lessons).toHaveLength(12);
    expect(lessons.every((l) => l.isEnriched === false && l.content.length === 0)).toBe(true);
    const firstModule = await Module.findOne({ course: course._id, order: 1 }).lean();
    expect(String(firstModule.lessons[0])).toBe(course.currentLessonId);
  });

  it.each([
    ['missing topic', { depth: 'standard' }, 'Topic name must be between 2 and 200 characters.'],
    ['non-string topic', { topic: 42, depth: 'standard' }, 'Topic name must be between 2 and 200 characters.'],
    ['one-character topic', { topic: 'A', depth: 'standard' }, 'Topic name must be between 2 and 200 characters.'],
    ['whitespace topic', { topic: '   ', depth: 'standard' }, 'Topic name must be between 2 and 200 characters.'],
    ['201-character topic', { topic: 'a'.repeat(201), depth: 'standard' }, 'Topic name must be between 2 and 200 characters.'],
    ['missing depth', { topic: 'React' }, 'Choose a course depth.'],
    ['unknown depth', { topic: 'React', depth: 'huge' }, 'Choose a course depth.'],
    ['inherited-key depth', { topic: 'React', depth: 'constructor' }, 'Choose a course depth.'],
    ['non-boolean sideQuest', { topic: 'React', depth: 'quick', sideQuest: 'yes' }, 'Invalid course options.'],
    ['non-boolean hinglishAudio', { topic: 'React', depth: 'quick', hinglishAudio: 1 }, 'Invalid course options.'],
  ])('400 for %s', async (_name, body, message) => {
    const res = await as(ALICE).post('/api/courses').send(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message });
    expect(generateCourseOutline).not.toHaveBeenCalled();
  });

  it('accepts a 200-character topic', async () => {
    generateCourseOutline.mockResolvedValueOnce(makeOutline());
    const res = await as(ALICE)
      .post('/api/courses')
      .send({ ...validBody, topic: 'a'.repeat(200) });
    expect(res.status).toBe(201);
  });

  it('409 while the same user already has a generation in flight', async () => {
    let release;
    generateCourseOutline.mockReturnValueOnce(new Promise((resolve) => (release = resolve)));

    const first = as(ALICE).post('/api/courses').send(validBody).then((r) => r);
    await vi.waitFor(() => expect(generateCourseOutline).toHaveBeenCalledTimes(1));

    const second = await as(ALICE).post('/api/courses').send(validBody);
    expect(second.status).toBe(409);
    expect(second.body).toEqual({
      message: 'A course is already being generated. Please wait for it to finish.',
    });

    // A different user is not blocked.
    generateCourseOutline.mockResolvedValueOnce(makeOutline());
    const other = await as(BOB).post('/api/courses').send(validBody);
    expect(other.status).toBe(201);

    release(makeOutline());
    expect((await first).status).toBe(201);

    // The lock is released afterwards.
    generateCourseOutline.mockResolvedValueOnce(makeOutline());
    expect((await as(ALICE).post('/api/courses').send(validBody)).status).toBe(201);
  });

  it('502 with the AI message when generation fails, and releases the lock', async () => {
    const aiMessage = "The AI couldn't generate this course. Please try again.";
    generateCourseOutline.mockRejectedValueOnce(Object.assign(new Error(aiMessage), { status: 502 }));
    const res = await as(ALICE).post('/api/courses').send(validBody);
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ message: aiMessage });
    expect(await Course.countDocuments()).toBe(0);

    await createFor(ALICE); // lock released, retry works
  });

  it('504 with the timeout message', async () => {
    const message = 'Course generation timed out. Please try again.';
    generateCourseOutline.mockRejectedValueOnce(Object.assign(new Error(message), { status: 504 }));
    const res = await as(ALICE).post('/api/courses').send(validBody);
    expect(res.status).toBe(504);
    expect(res.body).toEqual({ message });
  });

  it('hides unexpected errors behind a generic 500 message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    generateCourseOutline.mockRejectedValueOnce(new Error('mongo exploded at 10.0.0.5'));
    const res = await as(ALICE).post('/api/courses').send(validBody);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: 'Something went wrong. Please try again.' });
    console.error.mockRestore();
  });

  it('cleans up partial writes when saving fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    generateCourseOutline.mockResolvedValueOnce(makeOutline());
    const spy = vi.spyOn(Lesson, 'insertMany').mockRejectedValueOnce(new Error('disk full'));

    const res = await as(ALICE).post('/api/courses').send(validBody);
    expect(res.status).toBe(500);
    expect(await Course.countDocuments()).toBe(0);
    expect(await Module.countDocuments()).toBe(0);
    expect(await Lesson.countDocuments()).toBe(0);

    spy.mockRestore();
    console.error.mockRestore();
  });
});

describe('GET /api/courses/:courseId/outline', () => {
  it('returns modules and lessons without content, with completed flags', async () => {
    const course = await createFor(ALICE, validBody, makeOutline(3, 3));
    const before = await as(ALICE).get(`/api/courses/${course._id}/outline`);
    expect(before.status).toBe(200);

    const { modules } = before.body.course;
    expect(before.body.course).toMatchObject({ _id: course._id, title: 'Intro to React Hooks' });
    expect(modules.map((m) => m.order)).toEqual([1, 2, 3]);
    expect(modules[0].lessons.map((l) => l.order)).toEqual([1, 2, 3]);
    expect(modules[0].lessons[0]).not.toHaveProperty('content');
    expect(before.body.course.currentLessonId).toBe(modules[0].lessons[0]._id);
    expect(modules[0].lessons[0].completed).toBe(false);

    await as(ALICE)
      .patch(`/api/courses/${course._id}/progress`)
      .send({ lessonId: modules[0].lessons[0]._id, completed: true });
    const after = await as(ALICE).get(`/api/courses/${course._id}/outline`);
    expect(after.body.course.modules[0].lessons[0].completed).toBe(true);
  });

  it("404 for another user's course and for a malformed id", async () => {
    const course = await createFor(ALICE);

    const foreign = await as(BOB).get(`/api/courses/${course._id}/outline`);
    expect(foreign.status).toBe(404);
    expect(foreign.body).toEqual({ message: 'Course not found.' });

    const bad = await as(ALICE).get('/api/courses/abc/outline');
    expect(bad.status).toBe(404);
    expect(bad.body).toEqual({ message: 'Course not found.' });

    const missing = await as(ALICE).get(`/api/courses/${new mongoose.Types.ObjectId()}/outline`);
    expect(missing.status).toBe(404);
  });
});

describe('DELETE /api/courses/:courseId', () => {
  it('deletes the course, its modules and its lessons for the owner', async () => {
    const course = await createFor(ALICE);
    const other = await createFor(ALICE);

    const res = await as(ALICE).delete(`/api/courses/${course._id}`);
    expect(res.status).toBe(204);
    expect(res.text).toBe('');

    expect(await Course.countDocuments({ _id: course._id })).toBe(0);
    expect(await Module.countDocuments({ course: course._id })).toBe(0);
    expect(await Lesson.countDocuments({ course: course._id })).toBe(0);
    // The other course is untouched.
    expect(await Lesson.countDocuments({ course: other._id })).toBe(12);
  });

  it('404 for a non-owner and leaves the data alone', async () => {
    const course = await createFor(ALICE);
    const res = await as(BOB).delete(`/api/courses/${course._id}`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Course not found.' });
    expect(await Course.countDocuments({ _id: course._id })).toBe(1);
    expect(await Lesson.countDocuments({ course: course._id })).toBe(12);
  });

  it('404 for a malformed id', async () => {
    const res = await as(ALICE).delete('/api/courses/abc');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Course not found.' });
  });
});

describe('PATCH /api/courses/:courseId/progress', () => {
  let course;
  let lessonIds;

  beforeEach(async () => {
    course = await createFor(ALICE);
    const outline = await as(ALICE).get(`/api/courses/${course._id}/outline`);
    lessonIds = outline.body.course.modules.flatMap((m) => m.lessons.map((l) => l._id));
  });

  it('marks a lesson completed (idempotently) and updates lastActivityAt', async () => {
    const before = (await Course.findById(course._id).lean()).lastActivityAt;
    const send = () =>
      as(ALICE).patch(`/api/courses/${course._id}/progress`).send({ lessonId: lessonIds[1], completed: true });

    const first = await send();
    expect(first.status).toBe(200);
    expect(first.body.progress).toEqual({
      completedLessonIds: [lessonIds[1]],
      currentLessonId: course.currentLessonId,
      completedLessonCount: 1,
    });

    const second = await send();
    expect(second.body.progress.completedLessonCount).toBe(1);

    const after = (await Course.findById(course._id).lean()).lastActivityAt;
    expect(after.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('un-completes a lesson', async () => {
    const url = `/api/courses/${course._id}/progress`;
    await as(ALICE).patch(url).send({ lessonId: lessonIds[0], completed: true });
    const res = await as(ALICE).patch(url).send({ lessonId: lessonIds[0], completed: false });
    expect(res.status).toBe(200);
    expect(res.body.progress.completedLessonCount).toBe(0);
  });

  it('makes a lesson the current one', async () => {
    const res = await as(ALICE)
      .patch(`/api/courses/${course._id}/progress`)
      .send({ lessonId: lessonIds[4], makeCurrent: true });
    expect(res.status).toBe(200);
    expect(res.body.progress.currentLessonId).toBe(lessonIds[4]);
  });

  it('400 "Nothing to update." when neither flag is given', async () => {
    const res = await as(ALICE).patch(`/api/courses/${course._id}/progress`).send({ lessonId: lessonIds[0] });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'Nothing to update.' });
  });

  it("404 \"Lesson not found.\" for a lesson from another course or a bad id", async () => {
    const otherCourse = await createFor(ALICE);
    const otherOutline = await as(ALICE).get(`/api/courses/${otherCourse._id}/outline`);
    const foreignLesson = otherOutline.body.course.modules[0].lessons[0]._id;

    const url = `/api/courses/${course._id}/progress`;
    const foreign = await as(ALICE).patch(url).send({ lessonId: foreignLesson, completed: true });
    expect(foreign.status).toBe(404);
    expect(foreign.body).toEqual({ message: 'Lesson not found.' });

    const bad = await as(ALICE).patch(url).send({ lessonId: 'nope', completed: true });
    expect(bad.status).toBe(404);
    expect(bad.body).toEqual({ message: 'Lesson not found.' });
  });

  it("404 for a non-owner, and the owner's progress is unchanged", async () => {
    const url = `/api/courses/${course._id}/progress`;
    const res = await as(BOB).patch(url).send({ lessonId: lessonIds[0], completed: true });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Course not found.' });

    const stored = await Course.findById(course._id).lean();
    expect(stored.progress.completedLessons).toHaveLength(0);
  });

  it('404 for a malformed course id', async () => {
    const res = await as(ALICE).patch('/api/courses/abc/progress').send({ lessonId: lessonIds[0], completed: true });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Course not found.' });
  });
});
