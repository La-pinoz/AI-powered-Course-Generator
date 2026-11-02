import Course from '../models/Course.js';
import Module from '../models/Module.js';
import Lesson from '../models/Lesson.js';
import * as lessonQueue from './lessonQueue.js';

const httpError = (status, message) => Object.assign(new Error(message), { status });

// Another user's course, or a lesson from a different course, looks like a missing one.
async function findOwnedLesson(sub, courseId, lessonId) {
  const owned = await Course.exists({ _id: courseId, creator: sub });
  if (!owned) throw httpError(404, 'Course not found.');
  const lesson = await Lesson.findOne({ _id: lessonId, course: courseId }).lean();
  if (!lesson) throw httpError(404, 'Lesson not found.');
  return lesson;
}

// Never includes videoQuery, attempts, lastError or the reserved audio field.
export async function getLesson(sub, courseId, lessonId) {
  const lesson = await findOwnedLesson(sub, courseId, lessonId);
  const status = lesson.status ?? 'pending';

  // Opening a lesson restarts any unfinished work for the course (restarts and old courses), and a
  // lesson the user is waiting on jumps the line.
  await lessonQueue.ensureQueued(courseId);
  if (status === 'pending') lessonQueue.prioritize(courseId, lessonId);

  const module = await Module.findById(lesson.module).select('title order').lean();
  const response = {
    id: lesson._id,
    courseId: lesson.course,
    moduleId: lesson.module,
    moduleTitle: module?.title ?? '',
    moduleOrder: module?.order ?? 0,
    title: lesson.title,
    order: lesson.order,
    objectives: lesson.objectives ?? [],
    status,
  };
  if (status === 'ready') {
    response.summary = lesson.summary ?? '';
    response.content = lesson.content ?? [];
  }
  return response;
}

export async function retryLesson(sub, courseId, lessonId) {
  const lesson = await findOwnedLesson(sub, courseId, lessonId);
  const status = lesson.status ?? 'pending';

  if (status === 'ready') throw httpError(409, 'This lesson is already ready.');
  if (status === 'failed') {
    // Only flips if it is still failed, so two quick clicks don't double up.
    await Lesson.updateOne(
      { _id: lessonId, course: courseId, status: 'failed' },
      { $set: { status: 'pending', attempts: 0 }, $unset: { lastError: '' } },
    );
    await lessonQueue.ensureQueued(courseId);
    lessonQueue.prioritize(courseId, lessonId);
  }
  return { status: 'pending' };
}
