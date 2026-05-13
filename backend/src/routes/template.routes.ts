import { Router } from 'express';
import { 
  getTemplates, 
  createTemplate, 
  updateTemplate, 
  deleteTemplate 
} from '../controllers/template.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', getTemplates);
router.post('/', createTemplate);
router.put('/:id', updateTemplate);
router.delete('/:id', deleteTemplate);

export default router;
