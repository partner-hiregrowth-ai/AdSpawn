import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { FacebookService } from '../services/facebook.service';

export const getAccountAnalytics = async (req: AuthRequest, res: Response) => {
  const adAccountId = req.params.adAccountId as string;
  const q = (key: string) => {
    const v = req.query[key];
    return typeof v === 'string' ? v : undefined;
  };
  const datePreset = q('datePreset');
  const since = q('since');
  const until = q('until');

  try {
    const fbService = new FacebookService(req.userAccessToken!);
    const [summary, timeSeries, topCampaigns] = await Promise.all([
      fbService.getAccountInsights(adAccountId, datePreset, since, until),
      fbService.getAccountInsightsTimeSeries(adAccountId, datePreset, since, until),
      fbService.getCampaignInsights(adAccountId, datePreset, since, until, 5),
    ]);

    res.json({ summary, timeSeries, topCampaigns });
  } catch (error: any) {
    const msg = error.response?.data?.error?.message || error.message || 'Failed to fetch analytics';
    const status = msg.toLowerCase().includes('rate limit') ? 429 : 500;
    res.status(status).json({ message: msg });
  }
};
