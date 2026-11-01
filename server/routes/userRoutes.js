import { Router } from 'express';
import checkJwt from '../middlewares/checkJwt.js';
import { getMe, syncUser } from '../controllers/userController.js';

const router = Router();

router.post('/sync', checkJwt, syncUser);
router.get('/me', checkJwt, getMe);

export default router;
