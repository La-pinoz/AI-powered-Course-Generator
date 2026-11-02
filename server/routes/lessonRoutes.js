import { Router } from 'express';
import validateObjectId from '../middlewares/validateObjectId.js';
import { getLesson, retryLesson } from '../controllers/lessonController.js';
import { getAudio, getAudioFile, startAudio } from '../controllers/audioController.js';

// Mounted by courseRoutes at /:courseId/lessons, after checkJwt has run.
const router = Router({ mergeParams: true });

router.get('/:lessonId', validateObjectId, getLesson);
router.post('/:lessonId/retry', validateObjectId, retryLesson);

// Hinglish audio (Spec 6).
router.get('/:lessonId/audio', validateObjectId, getAudio);
router.post('/:lessonId/audio', validateObjectId, startAudio);
router.get('/:lessonId/audio/file', validateObjectId, getAudioFile);

export default router;
