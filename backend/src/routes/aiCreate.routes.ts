import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AiCreateController } from '../controllers/aiCreate.controller';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { aiLimiter } from '../middleware/rateLimit.middleware';

// Per-user daily quota on top of the per-IP burst limiter. AI calls cost real
// money per request; without this a single user (or leaked JWT) can drain the
// provider budget. In-memory is acceptable for a single instance — move to
// Redis/DB alongside the rate limiters when scaling out.
const AI_DAILY_LIMIT = Math.max(1, Number(process.env.AI_DAILY_LIMIT) || 100);
const dailyUsage = new Map<string, { day: string; count: number }>();

function aiDailyQuota(req: AuthRequest, res: Response, next: NextFunction) {
  const userId = req.userId || req.ip || 'anonymous';
  const today = new Date().toISOString().slice(0, 10);
  const entry = dailyUsage.get(userId);
  if (!entry || entry.day !== today) {
    dailyUsage.set(userId, { day: today, count: 1 });
    return next();
  }
  if (entry.count >= AI_DAILY_LIMIT) {
    return res.status(429).json({
      error: `Daily AI limit reached (${AI_DAILY_LIMIT} requests). It resets at midnight UTC.`,
    });
  }
  entry.count++;
  next();
}

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
router.post('/chat', aiLimiter, aiDailyQuota, validateBody(chatSchema), AiCreateController.chat);

export default router;
