import mongoose from 'mongoose';

const notFound = (message) => Object.assign(new Error(message), { status: 404 });

// A malformed :courseId (or :lessonId, on lesson routes) is the same as a missing one,
// so ids don't leak and casts don't 500.
export default function validateObjectId(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.courseId)) return next(notFound('Course not found.'));
  if (req.params.lessonId !== undefined && !mongoose.isValidObjectId(req.params.lessonId)) {
    return next(notFound('Lesson not found.'));
  }
  return next();
}
