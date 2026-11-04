import mongoose from 'mongoose';
import Course from '../models/Course.js';
import Module from '../models/Module.js';
import Lesson from '../models/Lesson.js';
import { generateCourseOutline } from './courseGenerationService.js';
import * as lessonQueue from './lessonQueue.js';
import * as audioJobs from './audioJobs.js';
import * as audioStorage from './audioStorage.js';
import * as videoJobs from './videoJobs.js';

const httpError = (status, message) => Object.assign(new Error(message), { status });
const courseNotFound = () => httpError(404, 'Course not found.');

// Subs with a generation in flight. In-memory, so it only protects a single server process.
const generating = new Set();

const toCourseSummary = (course) => ({
  _id: course._id,
  title: course.title,
  options: {
    sideQuest: course.options?.sideQuest ?? false,
    hinglishAudio: course.options?.hinglishAudio ?? false,
  },
  moduleCount: course.moduleCount,
  lessonCount: course.lessonCount,
  completedLessonCount: course.progress?.completedLessons?.length ?? 0,
  currentLessonId: course.progress?.currentLesson ?? null,
  createdAt: course.createdAt,
  lastActivityAt: course.lastActivityAt,
});

// Every query below filters by `creator`, so another user's course looks like a missing one.
export async function listCourses(sub) {
  const courses = await Course.find({ creator: sub })
    .select('title options moduleCount lessonCount progress createdAt lastActivityAt')
    .sort({ lastActivityAt: -1 })
    .lean();

  const summaries = courses.map(toCourseSummary);
  const stats = summaries.reduce(
    (acc, c) => ({
      courseCount: acc.courseCount + 1,
      lessonCount: acc.lessonCount + c.lessonCount,
      completedLessonCount: acc.completedLessonCount + c.completedLessonCount,
    }),
    { courseCount: 0, lessonCount: 0, completedLessonCount: 0 },
  );
  return { courses: summaries, stats };
}

export async function getOutline(sub, courseId) {
  const course = await Course.findOne({ _id: courseId, creator: sub })
    .select('title progress')
    .lean();
  if (!course) throw courseNotFound();

  const [modules, lessons] = await Promise.all([
    Module.find({ course: courseId }).select('title order').sort({ order: 1 }).lean(),
    Lesson.find({ course: courseId }).select('module title order status').sort({ order: 1 }).lean(),
  ]);

  // Opening a course (re)starts any unfinished lesson writing, e.g. after a restart or for courses
  // made before lessons existed. Not awaited: the outline doesn't wait on it.
  lessonQueue.ensureQueued(courseId).catch((err) => console.error('[lessons] ensureQueued failed:', err.message));

  const completed = new Set((course.progress?.completedLessons ?? []).map(String));
  const lessonsByModule = new Map();
  const counts = { ready: 0, failed: 0 };
  for (const lesson of lessons) {
    const key = String(lesson.module);
    const status = lesson.status ?? 'pending';
    if (status === 'ready') counts.ready += 1;
    if (status === 'failed') counts.failed += 1;
    if (!lessonsByModule.has(key)) lessonsByModule.set(key, []);
    lessonsByModule.get(key).push({
      _id: lesson._id,
      order: lesson.order,
      title: lesson.title,
      status,
      completed: completed.has(String(lesson._id)),
    });
  }

  return {
    course: {
      _id: course._id,
      title: course.title,
      currentLessonId: course.progress?.currentLesson ?? null,
      lessonsReady: counts.ready,
      lessonsFailed: counts.failed,
      lessonsTotal: lessons.length,
      modules: modules.map((m) => ({
        _id: m._id,
        order: m.order,
        title: m.title,
        lessons: lessonsByModule.get(String(m._id)) ?? [],
      })),
    },
  };
}

// Builds every document with its final ids first, then writes course → modules → lessons.
async function saveCourse(sub, { topic, depth, sideQuest, hinglishAudio }, outline) {
  const courseId = new mongoose.Types.ObjectId();
  const moduleDocs = [];
  const lessonDocs = [];

  outline.modules.forEach((mod, moduleIndex) => {
    const moduleId = new mongoose.Types.ObjectId();
    const lessonIds = mod.lessons.map(() => new mongoose.Types.ObjectId());
    moduleDocs.push({
      _id: moduleId,
      course: courseId,
      title: mod.title,
      order: moduleIndex + 1,
      lessons: lessonIds,
    });
    mod.lessons.forEach((lesson, lessonIndex) => {
      lessonDocs.push({
        _id: lessonIds[lessonIndex],
        course: courseId,
        module: moduleId,
        title: lesson.title,
        order: lessonIndex + 1,
        objectives: lesson.objectives,
        status: 'pending',
        content: [],
        isEnriched: false,
      });
    });
  });

  try {
    const course = await Course.create({
      _id: courseId,
      creator: sub,
      topic,
      title: outline.title,
      description: outline.description,
      depth,
      options: { sideQuest, hinglishAudio },
      modules: moduleDocs.map((m) => m._id),
      moduleCount: moduleDocs.length,
      lessonCount: lessonDocs.length,
      progress: { completedLessons: [], currentLesson: lessonDocs[0]._id },
    });
    await Module.insertMany(moduleDocs);
    await Lesson.insertMany(lessonDocs);
    return toCourseSummary(course.toObject());
  } catch (err) {
    // Don't leave a half-built course behind.
    await Promise.allSettled([
      Lesson.deleteMany({ course: courseId }),
      Module.deleteMany({ course: courseId }),
      Course.deleteOne({ _id: courseId }),
    ]);
    throw err;
  }
}

export async function createCourse(sub, input) {
  if (generating.has(sub)) {
    throw httpError(409, 'A course is already being generated. Please wait for it to finish.');
  }
  generating.add(sub);
  try {
    const outline = await generateCourseOutline(input);
    const course = await saveCourse(sub, input, outline);
    // Start writing the lessons in the background; the response doesn't wait for it.
    lessonQueue.ensureQueued(course._id).catch((err) => console.error('[lessons] ensureQueued failed:', err.message));
    return course;
  } finally {
    generating.delete(sub);
  }
}

export async function deleteCourse(sub, courseId) {
  const owned = await Course.exists({ _id: courseId, creator: sub });
  if (!owned) throw courseNotFound();

  lessonQueue.cancelCourse(courseId);
  audioJobs.cancelCourse(courseId);
  videoJobs.cancelCourse(courseId);
  await Lesson.deleteMany({ course: courseId });
  await audioStorage.deleteByCourse(courseId); // after the lessons, so a finishing audio job finds no lesson
  await Module.deleteMany({ course: courseId });
  await Course.deleteOne({ _id: courseId, creator: sub });
}

export async function updateProgress(sub, courseId, { lessonId, completed, makeCurrent }) {
  const owned = await Course.exists({ _id: courseId, creator: sub });
  if (!owned) throw courseNotFound();

  const lessonFound =
    mongoose.isValidObjectId(lessonId) && (await Lesson.exists({ _id: lessonId, course: courseId }));
  if (!lessonFound) throw httpError(404, 'Lesson not found.');

  const update = { $set: { lastActivityAt: new Date() } };
  if (completed === true) update.$addToSet = { 'progress.completedLessons': lessonId };
  if (completed === false) update.$pull = { 'progress.completedLessons': lessonId };
  if (makeCurrent === true) update.$set['progress.currentLesson'] = lessonId;

  const course = await Course.findOneAndUpdate({ _id: courseId, creator: sub }, update, {
    returnDocument: 'after',
  }).lean();
  if (!course) throw courseNotFound();

  return {
    progress: {
      completedLessonIds: course.progress.completedLessons,
      currentLessonId: course.progress.currentLesson ?? null,
      completedLessonCount: course.progress.completedLessons.length,
    },
  };
}
