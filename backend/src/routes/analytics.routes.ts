import { Router } from 'express';
import { getAccountAnalytics } from '../controllers/analytics.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { apiLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

router.use(authMiddleware);
router.use(apiLimiter);

router.get('/:adAccountId', getAccountAnalytics);

export default router;
