import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { FacebookService } from '../services/facebook.service';
import { sleep } from '../utils/sleep';

async function withMetaRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  const backoffs = [1000, 2000, 4000];
  for (let attempt = 0; attempt <= backoffs.length; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      const status = e.response?.status;
      const fbCode = e.response?.data?.error?.code;
      const isRateLimit = status === 429 || fbCode === 4 || fbCode === 17 || fbCode === 32 || fbCode === 613;
      if (isRateLimit && attempt < backoffs.length) {
        console.warn(`[Meta] rate limit on ${label}, retry ${attempt + 1} in ${backoffs[attempt]}ms`);
        await sleep(backoffs[attempt]);
        continue;
      }
      throw e;
    }
  }
  throw new Error(`max retries on ${label}`);
}

function metaResError(res: Response, error: any, fallback: string) {
  const msg: string = error.message || fallback;
  const status = msg.toLowerCase().includes('rate limit') ? 429 : 500;
  return res.status(status).json({ message: msg });
}

export const getAdAccounts = async (req: AuthRequest, res: Response) => {
  try {
    const fbService = new FacebookService(req.userAccessToken!);
    const accounts = await fbService.getAdAccounts();
    res.json(accounts);
  } catch (error) {
    console.error('Get Ad Accounts Error:', error);
    res.status(500).json({ message: 'Failed to fetch ad accounts' });
  }
};

export const getCampaigns = async (req: AuthRequest, res: Response) => {
  const adAccountId = req.params.adAccountId as string;
  try {
    const fbService = new FacebookService(req.userAccessToken!);
    const campaigns = await fbService.getCampaigns(adAccountId);
    res.json(campaigns);
  } catch (error: any) {
    return metaResError(res, error, 'Failed to fetch campaigns');
  }
};

export const getAdSets = async (req: AuthRequest, res: Response) => {
  const campaignId = req.params.campaignId as string;
  try {
    const fbService = new FacebookService(req.userAccessToken!);
    const adSets = await fbService.getAdSets(campaignId);
    res.json(adSets);
  } catch (error: any) {
    return metaResError(res, error, 'Failed to fetch ad sets');
  }
};

export const getAds = async (req: AuthRequest, res: Response) => {
  const adSetId = req.params.adSetId as string;
  try {
    const fbService = new FacebookService(req.userAccessToken!);
    const ads = await fbService.getAds(adSetId);
    res.json(ads);
  } catch (error: any) {
    return metaResError(res, error, 'Failed to fetch ads');
  }
};

export const updateObjectName = async (req: AuthRequest, res: Response) => {
  const { id, newName } = req.body;
  try {
    const fbService = new FacebookService(req.userAccessToken!);
    const result = await fbService.updateName(id, newName);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to update name', error: error.response?.data });
  }
};

export const bulkActivateObjects = async (req: AuthRequest, res: Response) => {
  const { ids } = req.body as { ids: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: 'ids must be a non-empty array' });
  }
  try {
    const fbService = new FacebookService(req.userAccessToken!);
    const results: { id: string; success: boolean; error?: string }[] = [];
    for (let i = 0; i < ids.length; i++) {
      if (i > 0) await sleep(150);
      try {
        await withMetaRetry(
          () => fbService.client.post(`/${ids[i]}`, { status: 'ACTIVE' }),
          `bulkActivate ${ids[i]}`,
        );
        results.push({ id: ids[i], success: true });
      } catch (error: any) {
        const msg = error.response?.data?.error?.message || error.message;
        results.push({ id: ids[i], success: false, error: msg });
      }
    }
    res.json({ results, activated: results.filter(r => r.success).length });
  } catch (error: any) {
    res.status(500).json({ message: 'Bulk activate failed', error: error.message });
  }
};

export const bulkPauseObjects = async (req: AuthRequest, res: Response) => {
  const { ids } = req.body as { ids: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: 'ids must be a non-empty array' });
  }
  try {
    const fbService = new FacebookService(req.userAccessToken!);
    const results: { id: string; success: boolean; error?: string }[] = [];
    for (let i = 0; i < ids.length; i++) {
      if (i > 0) await sleep(150);
      try {
        await withMetaRetry(
          () => fbService.client.post(`/${ids[i]}`, { status: 'PAUSED' }),
          `bulkPause ${ids[i]}`,
        );
        results.push({ id: ids[i], success: true });
      } catch (error: any) {
        const msg = error.response?.data?.error?.message || error.message;
        results.push({ id: ids[i], success: false, error: msg });
      }
    }
    res.json({ results, paused: results.filter(r => r.success).length });
  } catch (error: any) {
    res.status(500).json({ message: 'Bulk pause failed', error: error.message });
  }
};

export const bulkDeleteCampaigns = async (req: AuthRequest, res: Response) => {
  const { ids } = req.body as { ids: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: 'ids must be a non-empty array' });
  }
  try {
    const fbService = new FacebookService(req.userAccessToken!);
    const results: { id: string; success: boolean; error?: string }[] = [];
    for (let i = 0; i < ids.length; i++) {
      if (i > 0) await sleep(150);
      try {
        await withMetaRetry(
          () => fbService.delete(ids[i]),
          `bulkDelete ${ids[i]}`,
        );
        results.push({ id: ids[i], success: true });
      } catch (error: any) {
        const msg = error.response?.data?.error?.message || error.message;
        results.push({ id: ids[i], success: false, error: msg });
      }
    }
    res.json({ results, deleted: results.filter(r => r.success).length });
  } catch (error: any) {
    res.status(500).json({ message: 'Bulk delete failed', error: error.message });
  }
};
