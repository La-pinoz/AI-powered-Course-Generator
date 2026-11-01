import asyncHandler from '../utils/asyncHandler.js';
import * as courseService from '../services/courseService.js';
import { DEPTHS, TOPIC_MAX, TOPIC_MIN } from '../utils/courseConstants.js';

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });
const subOf = (req) => req.auth.payload.sub;

// GET /api/courses
export const listCourses = asyncHandler(async (req, res) => {
  res.json(await courseService.listCourses(subOf(req)));
});

// GET /api/courses/:courseId/outline
export const getOutline = asyncHandler(async (req, res) => {
  res.json(await courseService.getOutline(subOf(req), req.params.courseId));
});

// POST /api/courses
export const createCourse = asyncHandler(async (req, res) => {
  // Only these four fields are read; anything else in the body is ignored.
  const { topic, depth, sideQuest = false, hinglishAudio = false } = req.body ?? {};

  const trimmed = typeof topic === 'string' ? topic.trim() : '';
  if (trimmed.length < TOPIC_MIN || trimmed.length > TOPIC_MAX) {
    throw badRequest(`Topic name must be between ${TOPIC_MIN} and ${TOPIC_MAX} characters.`);
  }
  if (typeof depth !== 'string' || !Object.hasOwn(DEPTHS, depth)) {
    throw badRequest('Choose a course depth.');
  }
  if (typeof sideQuest !== 'boolean' || typeof hinglishAudio !== 'boolean') {
    throw badRequest('Invalid course options.');
  }

  const course = await courseService.createCourse(subOf(req), {
    topic: trimmed,
    depth,
    sideQuest,
    hinglishAudio,
  });
  res.status(201).json({ course });
});

// DELETE /api/courses/:courseId
export const deleteCourse = asyncHandler(async (req, res) => {
  await courseService.deleteCourse(subOf(req), req.params.courseId);
  res.status(204).end();
});

// PATCH /api/courses/:courseId/progress
export const updateProgress = asyncHandler(async (req, res) => {
  const { lessonId, completed, makeCurrent } = req.body ?? {};
  if (typeof completed !== 'boolean' && makeCurrent !== true) {
    throw badRequest('Nothing to update.');
  }
  res.json(
    await courseService.updateProgress(subOf(req), req.params.courseId, {
      lessonId,
      completed: typeof completed === 'boolean' ? completed : undefined,
      makeCurrent: makeCurrent === true,
    }),
  );
});
