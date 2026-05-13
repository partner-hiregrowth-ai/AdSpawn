import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../index';
import { FacebookService } from '../services/facebook.service';

export const getAdAccounts = async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (!user || !user.accessToken) {
      return res.status(401).json({ message: 'User not found or no access token' });
    }

    const fbService = new FacebookService(user.accessToken);
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
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user?.accessToken) {
      return res.status(401).json({ message: 'No access token' });
    }

    const fbService = new FacebookService(user.accessToken);
    const campaigns = await fbService.getCampaigns(adAccountId);
    
    res.json(campaigns);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch campaigns', error: error.response?.data });
  }
};

export const getAdSets = async (req: AuthRequest, res: Response) => {
  const campaignId = req.params.campaignId as string;
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const fbService = new FacebookService(user!.accessToken!);
    const adSets = await fbService.getAdSets(campaignId);
    res.json(adSets);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch ad sets' });
  }
};

export const getAds = async (req: AuthRequest, res: Response) => {
  const adSetId = req.params.adSetId as string;
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const fbService = new FacebookService(user!.accessToken!);
    const ads = await fbService.getAds(adSetId);
    res.json(ads);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch ads' });
  }
};
