import { Router } from 'express';
import validateObjectId from '../middlewares/validateObjectId.js';
import { getLesson, retryLesson } from '../controllers/lessonController.js';

// Mounted by courseRoutes at /:courseId/lessons, after checkJwt has run.
const router = Router({ mergeParams: true });

router.get('/:lessonId', validateObjectId, getLesson);
router.post('/:lessonId/retry', validateObjectId, retryLesson);

export default router;
