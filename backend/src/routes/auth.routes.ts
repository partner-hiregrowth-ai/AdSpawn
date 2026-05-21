import { Router } from 'express';
import { loginWithFacebook } from '../controllers/auth.controller';
import { authLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

router.post('/facebook', authLimiter, loginWithFacebook);

export default router;
