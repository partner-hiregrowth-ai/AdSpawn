import { Response } from 'express';
import fs from 'fs';
import { AuthRequest } from '../middleware/auth.middleware';
import { FacebookService } from '../services/facebook.service';

const VALID_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const VALID_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];

export const uploadImage = async (req: AuthRequest, res: Response) => {
  try {
    const file = req.file;
    const { adAccountId } = req.body;

    if (!file) return res.status(400).json({ error: 'No file provided' });
    if (!adAccountId) return res.status(400).json({ error: 'adAccountId is required' });
    if (!VALID_IMAGE_TYPES.includes(file.mimetype)) {
      return res.status(400).json({ error: `Invalid image type: ${file.mimetype}. Accepted: JPG, PNG, GIF, WebP` });
    }

    const fbService = new FacebookService(req.userAccessToken!);
    const { hash, id } = await fbService.uploadImage(adAccountId, file.buffer, file.originalname);
    console.log(`[Upload] Image uploaded: ${hash} (ID: ${id})`);
    res.json({ hash, id });
  } catch (error: any) {
    console.error('[Upload] Image upload failed:', error.response?.data || error.message);
    const metaMsg = error.response?.data?.error?.message;
    res.status(500).json({ error: metaMsg || 'Image upload failed' });
  }
};

export const uploadVideo = async (req: AuthRequest, res: Response) => {
  const file = req.file;
  try {
    const { adAccountId } = req.body;

    if (!file) return res.status(400).json({ error: 'No file provided' });
    if (!adAccountId) return res.status(400).json({ error: 'adAccountId is required' });
    if (!VALID_VIDEO_TYPES.includes(file.mimetype)) {
      return res.status(400).json({ error: `Invalid video type: ${file.mimetype}. Accepted: MP4, MOV, AVI, WebM` });
    }

    const fbService = new FacebookService(req.userAccessToken!);
    const videoId = await fbService.uploadVideo(adAccountId, file.path, file.originalname);
    res.json({ videoId });
  } catch (error: any) {
    console.error('[Upload] Video upload failed:', error.response?.data || error.message);
    const metaMsg = error.response?.data?.error?.message;
    res.status(500).json({ error: metaMsg || 'Video upload failed' });
  } finally {
    // Videos are written to a temp file by multer diskStorage — always clean up.
    if (file?.path) fs.unlink(file.path, () => {});
  }
};
