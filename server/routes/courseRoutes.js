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
import lessonRoutes from './lessonRoutes.js';
import moduleVideoRoutes from './moduleVideoRoutes.js';

const router = Router();

router.use(checkJwt);
router.use('/:courseId/lessons', lessonRoutes);
router.use('/:courseId/modules/:moduleId/video', moduleVideoRoutes);

router.get('/', listCourses);
router.post('/', createCourse);
router.get('/:courseId/outline', validateObjectId, getOutline);
router.delete('/:courseId', validateObjectId, deleteCourse);
router.patch('/:courseId/progress', validateObjectId, updateProgress);

export default router;
