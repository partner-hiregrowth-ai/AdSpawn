import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { FacebookService } from '../services/facebook.service';

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
    res.status(500).json({ message: 'Failed to fetch campaigns', error: error.response?.data });
  }
};

export const getAdSets = async (req: AuthRequest, res: Response) => {
  const campaignId = req.params.campaignId as string;
  try {
    const fbService = new FacebookService(req.userAccessToken!);
    const adSets = await fbService.getAdSets(campaignId);
    res.json(adSets);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch ad sets' });
  }
};

export const getAds = async (req: AuthRequest, res: Response) => {
  const adSetId = req.params.adSetId as string;
  try {
    const fbService = new FacebookService(req.userAccessToken!);
    const ads = await fbService.getAds(adSetId);
    res.json(ads);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch ads' });
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
