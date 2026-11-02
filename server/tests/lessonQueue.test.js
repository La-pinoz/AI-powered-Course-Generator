import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Mutable stand-in for the frozen config so tests can change the concurrency.
vi.mock('../config/env.js', () => ({ default: { lessonGenConcurrency: 2 } }));
vi.mock('../services/lessonGenerationService.js', () => ({ generateLessonContent: vi.fn() }));

const { default: config } = await import('../config/env.js');
const { generateLessonContent } = await import('../services/lessonGenerationService.js');
const queue = await import('../services/lessonQueue.js');
const { default: Course } = await import('../models/Course.js');
const { default: Module } = await import('../models/Module.js');
const { default: Lesson } = await import('../models/Lesson.js');

const result = (title) => ({
  content: [{ type: 'paragraph', text: `About ${title}` }],
  summary: `Summary of ${title}`,
  videoQuery: `${title} explained`,
});

// Builds a course with `modules` × `perModule` pending lessons titled "L<module>.<lesson>".
async function seedCourse(modules = 2, perModule = 3) {
  const courseId = new mongoose.Types.ObjectId();
  const moduleDocs = [];
  const lessonDocs = [];
  for (let m = 1; m <= modules; m++) {
    const moduleId = new mongoose.Types.ObjectId();
    moduleDocs.push({ _id: moduleId, course: courseId, title: `Module ${m}`, order: m });
    for (let l = 1; l <= perModule; l++) {
      lessonDocs.push({
        _id: new mongoose.Types.ObjectId(),
        course: courseId,
        module: moduleId,
        title: `L${m}.${l}`,
        order: l,
        objectives: ['Understand it'],
      });
    }
  }
  await Course.create({
    _id: courseId,
    creator: 'auth0|alice',
    topic: 'Topic',
    title: 'Course',
    description: 'About the course',
    depth: 'quick',
    moduleCount: modules,
    lessonCount: lessonDocs.length,
  });
  await Module.insertMany(moduleDocs);
  await Lesson.insertMany(lessonDocs);
  return { courseId, lessons: lessonDocs };
}

const titlesCalled = () => generateLessonContent.mock.calls.map(([input]) => input.lesson.title);

// A generator whose calls stay pending until released, so tests can look at the in-between state.
function gatedGenerator() {
  const gates = [];
  generateLessonContent.mockImplementation((input) => {
    return new Promise((resolve, reject) => {
      gates.push({ title: input.lesson.title, resolve: () => resolve(result(input.lesson.title)), reject });
    });
  });
  return {
    gates,
    releaseAll: async () => {
      // Releasing one call lets the queue start the next, so keep going until the queue drains.
      for (let i = 0; i < 100; i++) {
        const pending = gates.splice(0);
        if (pending.length === 0) {
          await new Promise((r) => setTimeout(r, 20));
          if (gates.length === 0) return;
        }
        pending.forEach((g) => g.resolve());
        await new Promise((r) => setTimeout(r, 20));
      }
    },
  };
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
  generateLessonContent.mockReset();
  generateLessonContent.mockImplementation(async (input) => result(input.lesson.title));
  config.lessonGenConcurrency = 2;
  queue._resetForTests();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  await queue.whenIdle();
  vi.restoreAllMocks();
  await Promise.all([Course.deleteMany({}), Module.deleteMany({}), Lesson.deleteMany({})]);
});

describe('lesson queue', () => {
  it('writes the lessons of a course in module, then lesson order and saves the content', async () => {
    const { courseId } = await seedCourse(2, 3);
    await queue.ensureQueued(courseId);
    await queue.whenIdle();

    expect(titlesCalled()).toEqual(['L1.1', 'L1.2', 'L1.3', 'L2.1', 'L2.2', 'L2.3']);

    const lessons = await Lesson.find({ course: courseId }).lean();
    expect(lessons.every((l) => l.status === 'ready' && l.isEnriched === true)).toBe(true);
    const first = lessons.find((l) => l.title === 'L1.1');
    expect(first).toMatchObject({
      summary: 'Summary of L1.1',
      videoQuery: 'L1.1 explained',
      contentVersion: 1,
      attempts: 1,
    });
    expect(first.content).toEqual([{ type: 'paragraph', text: 'About L1.1' }]);
    expect(first.generatedAt).toBeInstanceOf(Date);
  });

  it('gives the prompt the course, module and neighbouring lessons, across module boundaries', async () => {
    const { courseId } = await seedCourse(2, 2);
    await queue.ensureQueued(courseId);
    await queue.whenIdle();

    const inputs = generateLessonContent.mock.calls.map(([input]) => input);
    expect(inputs[0]).toMatchObject({
      course: { title: 'Course', description: 'About the course' },
      module: { title: 'Module 1' },
      lesson: { title: 'L1.1' },
      prevLesson: null,
      nextLesson: { title: 'L1.2' },
    });
    expect(inputs[1]).toMatchObject({ prevLesson: { title: 'L1.1' }, nextLesson: { title: 'L2.1' } });
    expect(inputs[2]).toMatchObject({ module: { title: 'Module 2' }, prevLesson: { title: 'L1.2' } });
    expect(inputs[3]).toMatchObject({ prevLesson: { title: 'L2.1' }, nextLesson: null });
  });

  it('does not rewrite a ready lesson', async () => {
    const { courseId, lessons } = await seedCourse(1, 3);
    await Lesson.updateOne({ _id: lessons[1]._id }, { status: 'ready', content: [{ type: 'paragraph', text: 'kept' }] });

    await queue.ensureQueued(courseId);
    await queue.whenIdle();

    expect(titlesCalled()).toEqual(['L1.1', 'L1.3']);
    const kept = await Lesson.findById(lessons[1]._id).lean();
    expect(kept.content).toEqual([{ type: 'paragraph', text: 'kept' }]);
  });

  it('prioritize moves a lesson to the front of its course', async () => {
    const { courseId, lessons } = await seedCourse(2, 3);
    const gen = gatedGenerator();

    await queue.ensureQueued(courseId);
    await vi.waitFor(() => expect(gen.gates).toHaveLength(1)); // L1.1 is being written
    queue.prioritize(courseId, lessons[5]._id); // L2.3
    await gen.releaseAll();
    await queue.whenIdle();

    expect(titlesCalled()).toEqual(['L1.1', 'L2.3', 'L1.2', 'L1.3', 'L2.1', 'L2.2']);
  });

  it('runs at most LESSON_GEN_CONCURRENCY calls at once, one per course', async () => {
    const courses = await Promise.all([seedCourse(1, 2), seedCourse(1, 2), seedCourse(1, 2)]);
    let running = 0;
    let peak = 0;
    const releases = [];
    generateLessonContent.mockImplementation(
      (input) =>
        new Promise((resolve) => {
          running++;
          peak = Math.max(peak, running);
          releases.push(() => {
            running--;
            resolve(result(input.lesson.title));
          });
        }),
    );

    for (const { courseId } of courses) await queue.ensureQueued(courseId);
    await vi.waitFor(() => expect(releases).toHaveLength(2));
    await new Promise((r) => setTimeout(r, 50));
    expect(generateLessonContent).toHaveBeenCalledTimes(2); // the third course waits

    // Drain: every release lets the next lesson start. Waits on the outcome, not a fixed time, so a
    // slow machine (other test files running in parallel) can't leave a call unreleased.
    await vi.waitFor(
      async () => {
        releases.splice(0).forEach((release) => release());
        expect(await Lesson.countDocuments({ status: 'ready' })).toBe(6);
      },
      { timeout: 15_000, interval: 30 },
    );
    await queue.whenIdle();

    expect(peak).toBeLessThanOrEqual(2);
    expect(generateLessonContent).toHaveBeenCalledTimes(6);
    expect(await Lesson.countDocuments({ status: 'ready' })).toBe(6);
  });

  it('never writes a lesson twice, even when ensureQueued is called repeatedly', async () => {
    const { courseId } = await seedCourse(1, 4);
    await Promise.all([queue.ensureQueued(courseId), queue.ensureQueued(courseId), queue.ensureQueued(courseId)]);
    await queue.ensureQueued(courseId);
    await queue.whenIdle();

    expect(generateLessonContent).toHaveBeenCalledTimes(4);
    expect(new Set(titlesCalled()).size).toBe(4);
  });

  it('marks only the failing lesson failed and moves on', async () => {
    const { courseId } = await seedCourse(1, 3);
    generateLessonContent.mockImplementation(async (input) => {
      if (input.lesson.title === 'L1.2') throw Object.assign(new Error('SECRET upstream detail'), { status: 502 });
      return result(input.lesson.title);
    });

    await queue.ensureQueued(courseId);
    await queue.whenIdle();

    const byTitle = Object.fromEntries((await Lesson.find({ course: courseId }).lean()).map((l) => [l.title, l]));
    expect(byTitle['L1.1'].status).toBe('ready');
    expect(byTitle['L1.2']).toMatchObject({ status: 'failed', isEnriched: false });
    expect(byTitle['L1.2'].lastError).toContain('SECRET'); // stored for debugging, never sent to clients
    expect(byTitle['L1.3'].status).toBe('ready');
    expect(generateLessonContent).toHaveBeenCalledTimes(3);

    // The queue never retries a failed lesson by itself.
    await queue.ensureQueued(courseId);
    await queue.whenIdle();
    expect(generateLessonContent).toHaveBeenCalledTimes(3);
  });

  it('cancelCourse stops the remaining work and nothing is written for a deleted course', async () => {
    const { courseId } = await seedCourse(1, 3);
    const gen = gatedGenerator();

    await queue.ensureQueued(courseId);
    await vi.waitFor(() => expect(gen.gates).toHaveLength(1));

    queue.cancelCourse(courseId);
    await Promise.all([Lesson.deleteMany({ course: courseId }), Module.deleteMany({ course: courseId }), Course.deleteMany({ _id: courseId })]);
    gen.gates.splice(0).forEach((g) => g.resolve()); // the in-flight call finishes afterwards
    await queue.whenIdle();

    expect(generateLessonContent).toHaveBeenCalledTimes(1);
    expect(await Lesson.countDocuments({ course: courseId })).toBe(0);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('recoverStaleLessons resets old "generating" lessons and gives pre-feature lessons a status', async () => {
    const { lessons } = await seedCourse(1, 3);
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    await Lesson.updateOne({ _id: lessons[0]._id }, { status: 'generating', generationStartedAt: tenMinutesAgo });
    await Lesson.updateOne({ _id: lessons[1]._id }, { status: 'generating', generationStartedAt: new Date() });
    await Lesson.collection.updateOne({ _id: lessons[2]._id }, { $unset: { status: '' } }); // old document

    await queue.recoverStaleLessons();

    const byTitle = Object.fromEntries((await Lesson.find().lean()).map((l) => [l.title, l]));
    expect(byTitle['L1.1'].status).toBe('pending');
    expect(byTitle['L1.2'].status).toBe('generating'); // recent: someone may still be writing it
    expect(byTitle['L1.3']).toMatchObject({ status: 'pending', attempts: 0, contentVersion: 1 });
    expect(generateLessonContent).not.toHaveBeenCalled(); // nothing is enqueued at boot
  });

  it('writes an old course whose lessons have no status the first time it is queued', async () => {
    const { courseId, lessons } = await seedCourse(1, 2);
    await Lesson.collection.updateMany({ course: courseId }, { $unset: { status: '' } });
    expect(lessons).toHaveLength(2);

    await queue.recoverStaleLessons();
    await queue.ensureQueued(courseId);
    await queue.whenIdle();

    expect(titlesCalled()).toEqual(['L1.1', 'L1.2']);
    expect(await Lesson.countDocuments({ course: courseId, status: 'ready' })).toBe(2);
  });

  it('ensureQueued also frees a lesson stuck in "generating" for this course', async () => {
    const { courseId, lessons } = await seedCourse(1, 2);
    await Lesson.updateOne(
      { _id: lessons[0]._id },
      { status: 'generating', generationStartedAt: new Date(Date.now() - 10 * 60 * 1000) },
    );

    await queue.ensureQueued(courseId);
    await queue.whenIdle();

    expect(titlesCalled()).toEqual(['L1.1', 'L1.2']);
    expect(await Lesson.countDocuments({ course: courseId, status: 'ready' })).toBe(2);
  });
});
