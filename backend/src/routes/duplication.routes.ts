import { Router } from 'express';
import { 
  duplicateCampaign, 
  duplicateAdSet, 
  duplicateAd,
  duplicateItems,
  getHistory 
} from '../controllers/duplication.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/history', getHistory);
router.post('/campaign', duplicateCampaign);
router.post('/adset', duplicateAdSet);
router.post('/ad', duplicateAd);
router.post('/bulk', duplicateItems);

export default router;
