import { Router } from 'express';
import { getAdAccounts, getCampaigns, getAdSets, getAds } from '../controllers/adAccount.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', getAdAccounts);
router.get('/:adAccountId/campaigns', getCampaigns);
router.get('/campaigns/:campaignId/adsets', getAdSets);
router.get('/adsets/:adSetId/ads', getAds);

export default router;
