import { Router } from 'express';
import { z } from 'zod';
import { AiCreateController } from '../controllers/aiCreate.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate.middleware';

const chatSchema = z.object({
  adAccountId: z.string().min(1, 'adAccountId is required'),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(4000),
      }),
    )
    .max(20),
});

const router = Router();
router.use(authMiddleware);
router.post('/chat', validateBody(chatSchema), AiCreateController.chat);

export default router;
