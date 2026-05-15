import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../prisma';
import { FacebookService } from '../services/facebook.service';
import { NamingEngine } from '../utils/namingEngine';
import { ObjectiveConversionService } from '../services/objectiveConversion.service';
import { DraftService } from '../services/draft/DraftService';
import { DraftPublishService } from '../services/draft/DraftPublishService';

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

export const deleteHistoryItem = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    await prisma.duplicateJob.deleteMany({
      where: {
        id,
        userId: req.userId
      },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete history item' });
  }
};

export const cleanupHistory = async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || !user.accessToken) return res.status(401).json({ message: 'Unauthorized' });

    const jobs = await prisma.duplicateJob.findMany({
      where: {
        userId: req.userId,
        status: 'COMPLETED',
        targetId: { not: null }
      },
    });

    const fbService = new FacebookService(user.accessToken);
    let deletedCount = 0;

    for (const job of jobs) {
      if (job.targetId) {
        const exists = await fbService.checkExistence(job.targetId);
        if (!exists) {
          await prisma.duplicateJob.delete({ where: { id: job.id } });
          deletedCount++;
        }
      }
    }

    res.json({ success: true, deletedCount });
  } catch (error) {
    console.error('Cleanup History Error:', error);
    res.status(500).json({ message: 'Failed to cleanup history' });
  }
};

export const previewConversion = async (req: AuthRequest, res: Response) => {
  const { type, id, targetObjective, newName } = req.body;
  console.log(`[DEBUG] previewConversion started:`, { type, id, targetObjective, newName });
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || !user.accessToken) {
      console.error(`[DEBUG] User not found or no access token for ID: ${req.userId}`);
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const fbService = new FacebookService(user.accessToken);
    const conversionService = new ObjectiveConversionService(fbService);

    console.log(`[DEBUG] Calling conversionService.getPreview...`);
    const preview = await conversionService.getPreview(type, id, targetObjective, newName);
    console.log(`[DEBUG] getPreview successful. Returning data.`);
    res.json(preview);
  } catch (error: any) {
    const errorData = error.response?.data || error.message;
    console.error('[DEBUG] previewConversion Error:', errorData);
    if (error.stack) console.error(error.stack);
    res.status(500).json({ message: 'Failed to preview conversion', error: errorData });
  }
};

export const convertObjective = async (req: AuthRequest, res: Response) => {
  const { items, targetObjective, newName, adAccountId, saveAsDraft } = req.body;
  const publishNow = saveAsDraft === false;
  console.log(`[DEBUG] convertObjective started (Bulk):`, { itemCount: items?.length, targetObjective, adAccountId, publishNow });
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || !user.accessToken) {
      console.error(`[DEBUG] User not found or no access token for ID: ${req.userId}`);
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const fbService = new FacebookService(user.accessToken);
    const conversionService = new ObjectiveConversionService(fbService);
    const results = [];

    for (const item of items) {
      if (item.type !== 'CAMPAIGN') continue;

      console.log(`[DEBUG] Starting deep campaign conversion for: ${item.id}`);
      const finalName = items.length === 1 ? newName : `${item.name} - Converted`;

      const draftCampaign = await DraftService.convertCampaignToDraft(
        item.id,
        targetObjective,
        finalName,
        adAccountId,
        user.id,
        user.accessToken
      );

      if (publishNow) {
        console.log(`[DEBUG] publishNow=true — publishing draft ${draftCampaign.id} immediately`);
        try {
          await DraftPublishService.publishCampaign(draftCampaign.id, user.accessToken);
        } catch (publishError: any) {
          console.error(`[DEBUG] Immediate publish failed for draft ${draftCampaign.id}:`, publishError.message);
          // Draft is saved; user can retry from Drafts page
        }
      }

      await prisma.duplicateJob.create({
        data: {
          userId: user.id,
          status: 'COMPLETED',
          type: 'CAMPAIGN',
          sourceId: item.id,
          targetId: draftCampaign.id,
          details: { newName: finalName, targetObjective, adAccountId, isConversion: true, savedAsDraft: !publishNow },
        },
      });
      results.push(draftCampaign);
    }

    res.json({ success: true, results });
  } catch (error: any) {
    const errorData = error.response?.data || error.message;
    console.error('[DEBUG] convertObjective Error:', errorData);
    if (error.stack) console.error(error.stack);
    res.status(500).json({ message: 'Failed to convert objective', error: errorData });
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
          console.log(`[DuplicationController] Fetching campaign_id for ad set: ${item.id}`);
          const originalResponse = await fbService.get(`/${item.id}`, { fields: 'campaign_id,campaign{id}' });
          const campaignId = originalResponse.data.campaign_id || originalResponse.data.campaign?.id;

          if (!campaignId) {
            console.error(`[DuplicationController] Failed to find campaign_id for ad set: ${item.id}`, originalResponse.data);
            throw new Error(`Could not find parent campaign for ad set ${item.id}`);
          }

          if (options.deep) {
            result = await fbService.duplicateAdSetDeep(item.id, newName, campaignId, adAccountId, customBudget);
          } else {
            result = await fbService.duplicateAdSet(item.id, newName, campaignId, adAccountId, customBudget);
          }
        } else if (item.type === 'AD') {
          const original = await fbService.get(`/${item.id}`, { fields: 'adset_id' });
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
    const errorDetail = error.response?.data || error.message || error;
    console.error('[DuplicationController] Bulk Duplicate Error:', errorDetail);
    if (error.stack) console.error(error.stack);

    res.status(500).json({
      message: 'Failed to duplicate items',
      error: errorDetail,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
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
