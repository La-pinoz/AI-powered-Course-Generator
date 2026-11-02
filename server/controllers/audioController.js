import asyncHandler from '../utils/asyncHandler.js';
import * as audioService from '../services/audioService.js';
import * as audioStorage from '../services/audioStorage.js';

const subOf = (req) => req.auth.payload.sub;
const ids = (req) => [subOf(req), req.params.courseId, req.params.lessonId];

// GET /api/courses/:courseId/lessons/:lessonId/audio
export const getAudio = asyncHandler(async (req, res) => {
  const status = await audioService.getAudioStatus(...ids(req));
  res.set('Cache-Control', 'no-store'); // polled while generating
  res.json(status);
});

// POST /api/courses/:courseId/lessons/:lessonId/audio — start, retry, or the cached result
export const startAudio = asyncHandler(async (req, res) => {
  const { code, body } = await audioService.startAudio(...ids(req));
  res.set('Cache-Control', 'no-store');
  res.status(code).json(body);
});

const FILE_HEADERS = ['Content-Type', 'Content-Length', 'Content-Disposition', 'ETag', 'Cache-Control'];

// GET /api/courses/:courseId/lessons/:lessonId/audio/file[?download=1]
export const getAudioFile = asyncHandler(async (req, res, next) => {
  const file = await audioService.getAudioFile(...ids(req));

  // `no-cache` + ETag: the browser revalidates, so regenerated audio (same URL, new file) is never
  // served stale from its cache, while an unchanged file costs only a 304.
  res.set({
    'Cache-Control': 'private, no-cache',
    ETag: `"${file.fileId}"`,
  });
  if (req.fresh) return res.status(304).end();

  const disposition = req.query.download === '1' ? 'attachment' : 'inline';
  res.set({
    'Content-Type': 'audio/mpeg',
    'Content-Length': String(file.length),
    'Content-Disposition': `${disposition}; filename="${file.filename}"`,
  });

  const stream = audioStorage.openStream(file.fileId);
  stream.on('error', (err) => {
    if (res.headersSent) return res.destroy(err);
    FILE_HEADERS.forEach((name) => res.removeHeader(name));
    return next(err);
  });
  return stream.pipe(res);
});
