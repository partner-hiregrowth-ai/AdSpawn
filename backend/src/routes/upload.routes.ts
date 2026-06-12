import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import os from 'os';
import { uploadImage, uploadVideo } from '../controllers/upload.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const IMAGE_MAX_BYTES = 10 * 1024 * 1024; // Meta ad images cap well below this
const VIDEO_MAX_BYTES = 100 * 1024 * 1024;

const router = Router();
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMAGE_MAX_BYTES },
});
// Videos go to a temp file, not RAM — a handful of concurrent 100MB buffers
// would otherwise OOM the process. The controller deletes the file when done.
const videoUpload = multer({
  storage: multer.diskStorage({ destination: os.tmpdir() }),
  limits: { fileSize: VIDEO_MAX_BYTES },
});

router.use(authMiddleware);

router.post('/image', imageUpload.single('file'), uploadImage);
router.post('/video', videoUpload.single('file'), uploadVideo);

router.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    const limitMb = req.path === '/image' ? IMAGE_MAX_BYTES / 1024 / 1024 : VIDEO_MAX_BYTES / 1024 / 1024;
    return res.status(413).json({ error: `File too large. Maximum size is ${limitMb}MB.` });
  }
  next(err);
});

export default router;
