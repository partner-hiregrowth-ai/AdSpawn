import { Router } from 'express';
import express from 'express';
import { loginWithFacebook, facebookDataDeletion, facebookDataDeletionStatus } from '../controllers/auth.controller';
import { authLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

router.post('/facebook', authLimiter, loginWithFacebook);

// Meta Data Deletion Callback — Facebook posts application/x-www-form-urlencoded.
router.post('/facebook/data-deletion', express.urlencoded({ extended: false }), facebookDataDeletion);
router.get('/facebook/data-deletion-status', facebookDataDeletionStatus);

export default router;
