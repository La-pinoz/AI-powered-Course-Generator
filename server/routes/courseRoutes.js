import { Router } from 'express';
import checkJwt from '../middlewares/checkJwt.js';
import validateObjectId from '../middlewares/validateObjectId.js';
import {
  createCourse,
  deleteCourse,
  getOutline,
  listCourses,
  updateProgress,
} from '../controllers/courseController.js';

const router = Router();

router.use(checkJwt);

router.get('/', listCourses);
router.post('/', createCourse);
router.get('/:courseId/outline', validateObjectId, getOutline);
router.delete('/:courseId', validateObjectId, deleteCourse);
router.patch('/:courseId/progress', validateObjectId, updateProgress);

export default router;
