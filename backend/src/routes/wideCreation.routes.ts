import { Router } from 'express';
import { WideCreationController } from '../controllers/wideCreation.controller';
import { authMiddleware, requireProfile } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { bulkLimiter } from '../middleware/rateLimit.middleware';
import {
  wideCreationValidateSchema,
  wideCreationGenerateSchema,
  wideCreationBulkApplySchema,
  wideCreationTreeSchema,
} from '../schemas/wideCreation.schemas';

const router = Router();

router.use(authMiddleware);

router.post('/validate', validateBody(wideCreationValidateSchema), WideCreationController.validate);
router.post('/generate', requireProfile, bulkLimiter, validateBody(wideCreationGenerateSchema), WideCreationController.generate);
router.post('/bulk-apply', requireProfile, bulkLimiter, validateBody(wideCreationBulkApplySchema), WideCreationController.bulkApplyFields);
router.post('/tree', requireProfile, validateBody(wideCreationTreeSchema), WideCreationController.getTree);

export default router;
