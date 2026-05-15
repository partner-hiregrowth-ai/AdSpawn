import { Router } from 'express';
import { DraftController } from '../controllers/draft.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.post('/duplicate', DraftController.duplicateToDraft);
router.get('/campaigns', DraftController.listCampaigns);
router.get('/campaigns/:id', DraftController.getCampaign);
router.patch('/campaigns/:id', DraftController.updateCampaign);
router.delete('/campaigns/:id', DraftController.deleteCampaign);

router.patch('/adsets/:id', DraftController.updateAdSet);
router.patch('/ads/:id', DraftController.updateAd);

router.post('/campaigns/bulk-publish', DraftController.bulkPublishDrafts);
router.post('/campaigns/:id/validate', DraftController.validateDraft);
router.post('/campaigns/:id/publish', DraftController.publishDraft);

export default router;
