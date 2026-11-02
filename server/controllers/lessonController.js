import asyncHandler from '../utils/asyncHandler.js';
import * as lessonService from '../services/lessonService.js';

const subOf = (req) => req.auth.payload.sub;

// GET /api/courses/:courseId/lessons/:lessonId
export const getLesson = asyncHandler(async (req, res) => {
  const lesson = await lessonService.getLesson(subOf(req), req.params.courseId, req.params.lessonId);
  res.set('Cache-Control', 'no-store'); // the client polls this while a lesson is being written
  res.json(lesson);
});

// POST /api/courses/:courseId/lessons/:lessonId/retry
export const retryLesson = asyncHandler(async (req, res) => {
  const result = await lessonService.retryLesson(subOf(req), req.params.courseId, req.params.lessonId);
  res.status(202).json(result);
});
