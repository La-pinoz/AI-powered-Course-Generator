import asyncHandler from '../utils/asyncHandler.js';
import * as moduleVideoService from '../services/moduleVideoService.js';

const subOf = (req) => req.auth.payload.sub;
const ids = (req) => [subOf(req), req.params.courseId, req.params.moduleId];

// GET /api/courses/:courseId/modules/:moduleId/video — status; the first open starts the search
export const getVideo = asyncHandler(async (req, res) => {
  const body = await moduleVideoService.getVideo(...ids(req));
  res.set('Cache-Control', 'no-store'); // polled while searching
  res.json(body);
});

// POST /api/courses/:courseId/modules/:moduleId/video/retry — Try again and Search again
export const retryVideo = asyncHandler(async (req, res) => {
  const { code, body } = await moduleVideoService.retryVideo(...ids(req));
  res.set('Cache-Control', 'no-store');
  res.status(code).json(body);
});

// PATCH /api/courses/:courseId/modules/:moduleId/video — { videoId }: Show another video
export const selectVideo = asyncHandler(async (req, res) => {
  res.json(await moduleVideoService.selectVideo(...ids(req), req.body?.videoId));
});

// POST /api/courses/:courseId/modules/:moduleId/video/report-unavailable — { videoId }: a player error
export const reportUnavailable = asyncHandler(async (req, res) => {
  res.json(await moduleVideoService.reportUnavailable(...ids(req), req.body?.videoId));
});
