import { Router } from 'express';
import { loginWithFacebook } from '../controllers/auth.controller';

const router = Router();

router.post('/facebook', loginWithFacebook);

export default router;
