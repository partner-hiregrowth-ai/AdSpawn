import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../index';
import { FacebookService } from '../services/facebook.service';
import { NamingEngine } from '../utils/namingEngine';

export const getHistory = async (req: AuthRequest, res: Response) => {
  try {
    const jobs = await prisma.duplicateJob.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch history' });
  }
};

export const duplicateItems = async (req: AuthRequest, res: Response) => {
  const { items, adAccountId, options } = req.body;
  // items: Array<{ id: string, type: 'CAMPAIGN' | 'ADSET' | 'AD', name: string }>
  // options: { numCopies: number, renamePattern: string, deep: boolean, customBudget?: string, context?: any }

  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || !user.accessToken) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    const fbService = new FacebookService(user.accessToken);
    const results = [];

    for (const item of items) {
      for (let i = 0; i < (options.numCopies || 1); i++) {
        // Advanced Naming Engine Integration
        const namingContext = {
          ...options.context,
          campaign_name: item.type === 'CAMPAIGN' ? item.name : undefined,
          adset_name: item.type === 'ADSET' ? item.name : undefined,
          ad_name: item.type === 'AD' ? item.name : undefined,
          iteration_number: i + 1,
          budget: options.customBudget ? parseFloat(options.customBudget) : undefined,
          date: new Date()
        };

        const newName = NamingEngine.parse(options.renamePattern, namingContext);
        
        let result;
        
        // Convert custom budget to cents/satang (e.g., 20 -> 2000)
        let customBudget = undefined;
        if (options.customBudget) {
          let budgetValue = parseFloat(options.customBudget);
          
          if (budgetValue > 0 && budgetValue < 40) {
            console.log(`[Backend] Budget ${budgetValue} THB is too low. Bumping to safety minimum of 40 THB.`);
            budgetValue = 40;
          }
          
          customBudget = (budgetValue * 100).toString();
        }

        if (item.type === 'CAMPAIGN') {
          if (options.deep) {
            result = await fbService.duplicateCampaignDeep(item.id, newName, adAccountId, customBudget);
          } else {
            result = await fbService.duplicateCampaign(item.id, newName, adAccountId, customBudget);
          }
        } else if (item.type === 'ADSET') {
          const original = await (fbService as any).client.get(`/${item.id}?fields=campaign_id`);
          result = await fbService.duplicateAdSet(item.id, newName, original.data.campaign_id, adAccountId, customBudget);
        } else if (item.type === 'AD') {
          const original = await (fbService as any).client.get(`/${item.id}?fields=adset_id`);
          result = await fbService.duplicateAd(item.id, newName, original.data.adset_id, adAccountId);
        }

        if (result) {
          await prisma.duplicateJob.create({
            data: {
              userId: user.id,
              status: 'COMPLETED',
              type: item.type,
              sourceId: item.id,
              targetId: result.id,
              details: { newName, adAccountId, options },
            },
          });
          results.push(result);
        }
      }
    }

    res.json({ success: true, results });
  } catch (error: any) {
    console.error('[DuplicationController] Bulk Duplicate Error:', error.response?.data || error.message || error);
    res.status(500).json({ message: 'Failed to duplicate items', error: error.response?.data || error.message });
  }
};

export const duplicateCampaign = async (req: AuthRequest, res: Response) => {
  const { campaignId, newName, adAccountId } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const fbService = new FacebookService(user!.accessToken!);

    const result = await fbService.duplicateCampaign(campaignId, newName, adAccountId);

    await prisma.duplicateJob.create({
      data: {
        userId: user!.id,
        status: 'COMPLETED',
        type: 'CAMPAIGN',
        sourceId: campaignId,
        targetId: result.id,
        details: { newName, adAccountId },
      },
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to duplicate campaign', error: error.response?.data });
  }
};

export const duplicateAdSet = async (req: AuthRequest, res: Response) => {
  const { adSetId, newName, campaignId, adAccountId } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const fbService = new FacebookService(user!.accessToken!);

    const result = await fbService.duplicateAdSet(adSetId, newName, campaignId, adAccountId);

    await prisma.duplicateJob.create({
      data: {
        userId: user!.id,
        status: 'COMPLETED',
        type: 'ADSET',
        sourceId: adSetId,
        targetId: result.id,
        details: { newName, campaignId, adAccountId },
      },
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to duplicate ad set', error: error.response?.data });
  }
};

export const duplicateAd = async (req: AuthRequest, res: Response) => {
  const { adId, newName, adSetId, adAccountId } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const fbService = new FacebookService(user!.accessToken!);

    const result = await fbService.duplicateAd(adId, newName, adSetId, adAccountId);

    await prisma.duplicateJob.create({
      data: {
        userId: user!.id,
        status: 'COMPLETED',
        type: 'AD',
        sourceId: adId,
        targetId: result.id,
        details: { newName, adSetId, adAccountId },
      },
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to duplicate ad', error: error.response?.data });
  }
};
