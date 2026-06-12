import { Router } from 'express';
import { getAccountAnalytics } from '../controllers/analytics.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/:adAccountId', getAccountAnalytics);

export default router;
