import { Router } from 'express';
import { getAccountAnalytics, getLevelInsights } from '../controllers/analytics.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/:adAccountId/insights/:level', getLevelInsights);
router.get('/:adAccountId', getAccountAnalytics);

export default router;
