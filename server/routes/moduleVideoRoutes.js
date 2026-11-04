import { Router } from 'express';
import validateObjectId from '../middlewares/validateObjectId.js';
import { getVideo, reportUnavailable, retryVideo, selectVideo } from '../controllers/moduleVideoController.js';

// Mounted by courseRoutes at /:courseId/modules/:moduleId/video, after checkJwt has run (Spec 7).
const router = Router({ mergeParams: true });

router.get('/', validateObjectId, getVideo);
router.patch('/', validateObjectId, selectVideo);
router.post('/retry', validateObjectId, retryVideo);
router.post('/report-unavailable', validateObjectId, reportUnavailable);

export default router;
