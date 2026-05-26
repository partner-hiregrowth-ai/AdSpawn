import { Router } from 'express';
import {
  duplicateCampaign,
  duplicateAdSet,
  duplicateAd,
  duplicateItems,
  getHistory,
  deleteHistoryItem,
  cleanupHistory,
  previewConversion,
  convertObjective,
  optimizeDuplicate,
  optimizeConversion,
  validateOptimization,
} from '../controllers/duplication.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { bulkLimiter } from '../middleware/rateLimit.middleware';
import { bulkDuplicateSchema, convertObjectiveSchema } from '../schemas/duplication.schemas';

const router = Router();

router.use(authMiddleware);

router.post('/sync', cleanupHistory);
router.get('/history', getHistory);
router.delete('/history/:id', deleteHistoryItem);
router.post('/campaign', bulkLimiter, duplicateCampaign);
router.post('/adset', bulkLimiter, duplicateAdSet);
router.post('/ad', bulkLimiter, duplicateAd);
router.post('/bulk', bulkLimiter, validateBody(bulkDuplicateSchema), duplicateItems);

// Objective Conversion Routes
router.post('/preview-conversion', previewConversion);
router.post('/convert-objective', bulkLimiter, validateBody(convertObjectiveSchema), convertObjective);

// Optimization Routes
router.post('/optimize-duplicate', bulkLimiter, optimizeDuplicate);
router.post('/optimize-conversion', bulkLimiter, optimizeConversion);
router.post('/validate-optimization', validateOptimization);

export default router;
