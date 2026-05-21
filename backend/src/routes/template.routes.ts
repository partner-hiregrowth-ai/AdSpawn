import { Router } from 'express';
import {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from '../controllers/template.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { createTemplateSchema, updateTemplateSchema } from '../schemas/template.schemas';

const router = Router();

router.use(authMiddleware);

router.get('/', getTemplates);
router.post('/', validateBody(createTemplateSchema), createTemplate);
router.put('/:id', validateBody(updateTemplateSchema), updateTemplate);
router.delete('/:id', deleteTemplate);

export default router;
