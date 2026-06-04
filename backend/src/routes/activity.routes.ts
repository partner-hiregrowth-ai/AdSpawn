import { Router } from 'express';
import { getTeamActivity } from '../controllers/activity.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', getTeamActivity);

export default router;
