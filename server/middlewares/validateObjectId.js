import mongoose from 'mongoose';

// A malformed :courseId is the same as a missing course, so ids don't leak and casts don't 500.
export default function validateObjectId(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.courseId)) {
    const error = new Error('Course not found.');
    error.status = 404;
    return next(error);
  }
  return next();
}
