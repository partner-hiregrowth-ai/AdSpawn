import { Router } from 'express';
import { getAdAccounts, getCampaigns, getAdSets, getAds, updateObjectName, bulkDeleteCampaigns, bulkActivateObjects, bulkPauseObjects } from '../controllers/adAccount.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { bulkLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', getAdAccounts);
router.get('/:adAccountId/campaigns', getCampaigns);
router.get('/campaigns/:campaignId/adsets', getAdSets);
router.get('/adsets/:adSetId/ads', getAds);
router.patch('/update-name', updateObjectName);
router.post('/bulk-activate', bulkLimiter, bulkActivateObjects);
router.post('/bulk-pause', bulkLimiter, bulkPauseObjects);
router.post('/bulk-delete', bulkLimiter, bulkDeleteCampaigns);

export default router;
