import { Router } from 'express';
import { DraftController } from '../controllers/draft.controller';
import { authMiddleware, requireProfile } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { bulkLimiter } from '../middleware/rateLimit.middleware';
import {
  duplicateToDraftSchema,
  bulkPublishSchema,
  bulkDeleteSchema,
  bulkUpdateSchema,
  bulkEditApplySchema,
  updateEntitySchema,
  getFormSchemaBodySchema,
  importCampaignSchema,
} from '../schemas/draft.schemas';

const router = Router();

router.use(authMiddleware);

// Pure schema generation — the only draft endpoint that doesn't touch profile data.
router.post('/form-schema', validateBody(getFormSchemaBodySchema), DraftController.getFormSchema);

// Everything below operates on profile-scoped drafts.
router.use(requireProfile);

router.post('/duplicate', validateBody(duplicateToDraftSchema), DraftController.duplicateToDraft);
router.get('/campaigns', DraftController.listCampaigns);
router.get('/campaigns/:id', DraftController.getCampaign);
router.patch('/campaigns/:id', validateBody(updateEntitySchema), DraftController.updateCampaign);
router.delete('/campaigns/:id', DraftController.deleteCampaign);

router.patch('/adsets/:id', validateBody(updateEntitySchema), DraftController.updateAdSet);
router.patch('/ads/:id', validateBody(updateEntitySchema), DraftController.updateAd);

router.post('/campaigns/bulk-publish', bulkLimiter, validateBody(bulkPublishSchema), DraftController.bulkPublishDrafts);
router.post('/campaigns/bulk-publish-stream', bulkLimiter, validateBody(bulkPublishSchema), DraftController.bulkPublishStream);
router.post('/campaigns/bulk-update', bulkLimiter, validateBody(bulkUpdateSchema), DraftController.bulkUpdateCampaigns);
router.post('/campaigns/bulk-delete', bulkLimiter, validateBody(bulkDeleteSchema), DraftController.bulkDeleteDrafts);
router.post('/bulk-edit/schema', DraftController.bulkEditSchema);
router.post('/bulk-edit/validate', DraftController.bulkEditValidate);
router.post('/bulk-edit/apply', bulkLimiter, validateBody(bulkEditApplySchema), DraftController.bulkEditApply);
router.get('/campaigns/:id/export', DraftController.exportCampaign);
router.post('/import', validateBody(importCampaignSchema), DraftController.importCampaign);
router.post('/campaigns/:id/validate', DraftController.validateDraft);
router.post('/campaigns/:id/publish', DraftController.publishDraft);
router.post('/campaigns/:id/cleanup', DraftController.cleanupMetaObjects);
router.post('/campaigns/bulk-share', bulkLimiter, DraftController.bulkShareDrafts);
router.post('/campaigns/:id/share', DraftController.shareDraft);
router.delete('/campaigns/:id/share/:shareId', DraftController.revokeDraftShare);
router.get('/campaigns/:id/shares', DraftController.getDraftShares);
router.get('/shared-with-me', DraftController.getSharedWithMe);

export default router;
