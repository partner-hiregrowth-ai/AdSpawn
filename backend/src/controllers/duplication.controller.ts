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
      where: { id, userId: req.userId },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete history item' });
  }
};

export const cleanupHistory = async (req: AuthRequest, res: Response) => {
  try {
    const jobs = await prisma.duplicateJob.findMany({
      where: {
        userId: req.userId,
        status: 'COMPLETED',
        targetId: { not: null }
      },
    });

    const fbService = new FacebookService(req.userAccessToken!);

    const BATCH = 10;
    let deletedCount = 0;
    for (let i = 0; i < jobs.length; i += BATCH) {
      const batch = jobs.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map(async (job) => {
          if (!job.targetId) return false;
          const exists = await fbService.checkExistence(job.targetId);
          return exists ? null : job.id;
        })
      );
      const toDelete = results.filter((id): id is string => id !== null && id !== false);
      if (toDelete.length > 0) {
        await prisma.duplicateJob.deleteMany({ where: { id: { in: toDelete } } });
        deletedCount += toDelete.length;
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
  try {
    const fbService = new FacebookService(req.userAccessToken!);
    const conversionService = new ObjectiveConversionService(fbService);
    const preview = await conversionService.getPreview(type, id, targetObjective, newName);
    res.json(preview);
  } catch (error: any) {
    const errorData = error.response?.data || error.message;
    console.error('previewConversion Error:', errorData);
    res.status(500).json({ message: 'Failed to preview conversion', error: errorData });
  }
};

export const convertObjective = async (req: AuthRequest, res: Response) => {
  const { items, targetObjective, newName, adAccountId, saveAsDraft } = req.body;
  const publishNow = saveAsDraft === false;
  try {
    const results = [];

    for (const item of items) {
      if (item.type !== 'CAMPAIGN') continue;

      const finalName = items.length === 1 ? newName : `${item.name} - Converted`;

      const draftCampaign = await DraftService.convertCampaignToDraft(
        item.id,
        targetObjective,
        finalName,
        adAccountId,
        req.userId!,
        req.userAccessToken!
      );

      if (publishNow) {
        try {
          await DraftPublishService.publishCampaign(draftCampaign.id, req.userAccessToken!);
        } catch (publishError: any) {
          console.error(`Immediate publish failed for draft ${draftCampaign.id}:`, publishError.message);
        }
      }

      await prisma.duplicateJob.create({
        data: {
          userId: req.userId!,
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
    console.error('convertObjective Error:', errorData);
    res.status(500).json({ message: 'Failed to convert objective', error: errorData });
  }
};

export const duplicateItems = async (req: AuthRequest, res: Response) => {
  const { items, adAccountId, options } = req.body;

  try {
    const fbService = new FacebookService(req.userAccessToken!);
    const results = [];

    for (const item of items) {
      for (let i = 0; i < (options.numCopies || 1); i++) {
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

        let customBudget = undefined;
        if (options.customBudget) {
          let budgetValue = parseFloat(options.customBudget);
          if (budgetValue > 0 && budgetValue < 40) {
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
          const originalResponse = await fbService.get(`/${item.id}`, { fields: 'campaign_id,campaign{id}' });
          const campaignId = originalResponse.data.campaign_id || originalResponse.data.campaign?.id;

          if (!campaignId) {
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
              userId: req.userId!,
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

    res.status(500).json({
      message: 'Failed to duplicate items',
      error: errorDetail,
    });
  }
};

export const duplicateCampaign = async (req: AuthRequest, res: Response) => {
  const { campaignId, newName, adAccountId } = req.body;
  try {
    const fbService = new FacebookService(req.userAccessToken!);
    const result = await fbService.duplicateCampaign(campaignId, newName, adAccountId);

    await prisma.duplicateJob.create({
      data: {
        userId: req.userId!,
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
    const fbService = new FacebookService(req.userAccessToken!);
    const result = await fbService.duplicateAdSet(adSetId, newName, campaignId, adAccountId);

    await prisma.duplicateJob.create({
      data: {
        userId: req.userId!,
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
    const fbService = new FacebookService(req.userAccessToken!);
    const result = await fbService.duplicateAd(adId, newName, adSetId, adAccountId);

    await prisma.duplicateJob.create({
      data: {
        userId: req.userId!,
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
