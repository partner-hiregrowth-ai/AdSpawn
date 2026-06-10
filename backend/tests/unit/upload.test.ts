import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadImage, uploadVideo } from '../../src/controllers/upload.controller';

let mockUploadImage: ReturnType<typeof vi.fn>;
let mockUploadVideo: ReturnType<typeof vi.fn>;

vi.mock('../../src/services/facebook.service', () => ({
  FacebookService: vi.fn().mockImplementation(function () {
    return {
      uploadImage: (...args: any[]) => mockUploadImage(...args),
      uploadVideo: (...args: any[]) => mockUploadVideo(...args),
    };
  }),
}));

function makeReq(overrides: any = {}) {
  return {
    userAccessToken: 'test-token',
    file: {
      buffer: Buffer.from('fake-file'),
      originalname: 'test.jpg',
      mimetype: 'image/jpeg',
    },
    body: { adAccountId: 'act_123' },
    ...overrides,
  } as any;
}

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUploadImage = vi.fn().mockResolvedValue({ hash: 'abc123hash', id: 'img_789' });
  mockUploadVideo = vi.fn().mockResolvedValue('video_456');
});

describe('Upload Controller', () => {
  describe('uploadImage', () => {
    it('returns image hash on successful upload', async () => {
      const req = makeReq();
      const res = makeRes();
      await uploadImage(req, res);
      expect(res.json).toHaveBeenCalledWith({ hash: 'abc123hash', id: 'img_789' });
    });

    it('returns 400 when no file provided', async () => {
      const req = makeReq({ file: undefined });
      const res = makeRes();
      await uploadImage(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'No file provided' });
    });

    it('returns 400 when adAccountId missing', async () => {
      const req = makeReq({ body: {} });
      const res = makeRes();
      await uploadImage(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'adAccountId is required' });
    });

    it('returns 400 for invalid MIME type', async () => {
      const req = makeReq({ file: { buffer: Buffer.from('x'), originalname: 'test.txt', mimetype: 'text/plain' } });
      const res = makeRes();
      await uploadImage(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('Invalid image type') }));
    });

    it('returns 500 on Meta API error', async () => {
      mockUploadImage.mockRejectedValue({ response: { data: { error: { message: 'Meta says no' } } } });
      const req = makeReq();
      const res = makeRes();
      await uploadImage(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Meta says no' });
    });
  });

  describe('uploadVideo', () => {
    it('returns video ID on successful upload', async () => {
      const req = makeReq({ file: { buffer: Buffer.from('video'), originalname: 'test.mp4', mimetype: 'video/mp4' } });
      const res = makeRes();
      await uploadVideo(req, res);
      expect(res.json).toHaveBeenCalledWith({ videoId: 'video_456' });
    });

    it('returns 400 when no file provided', async () => {
      const req = makeReq({ file: undefined });
      const res = makeRes();
      await uploadVideo(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 for invalid MIME type', async () => {
      const req = makeReq({ file: { buffer: Buffer.from('x'), originalname: 'test.jpg', mimetype: 'image/jpeg' } });
      const res = makeRes();
      await uploadVideo(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('Invalid video type') }));
    });

    it('returns 400 when adAccountId missing', async () => {
      const req = makeReq({ file: { buffer: Buffer.from('v'), originalname: 'test.mp4', mimetype: 'video/mp4' }, body: {} });
      const res = makeRes();
      await uploadVideo(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
