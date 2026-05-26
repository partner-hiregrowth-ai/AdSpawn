import { Router } from 'express';
import { WideCreationController } from '../controllers/wideCreation.controller';
import { authMiddleware } from '../middleware/auth.middleware';
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
router.post('/generate', bulkLimiter, validateBody(wideCreationGenerateSchema), WideCreationController.generate);
router.post('/bulk-apply', bulkLimiter, validateBody(wideCreationBulkApplySchema), WideCreationController.bulkApplyFields);
router.post('/tree', validateBody(wideCreationTreeSchema), WideCreationController.getTree);

export default router;
