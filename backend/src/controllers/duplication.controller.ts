import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../prisma';
import { sleep } from '../utils/sleep';
import { FacebookService } from '../services/facebook.service';
import { NamingEngine } from '../utils/namingEngine';
import { ObjectiveConversionService } from '../services/objectiveConversion.service';
import { DraftService } from '../services/draft/DraftService';
import { DraftPublishService } from '../services/draft/DraftPublishService';
import { FieldOptimizationEngine } from '../services/draft/FieldOptimizationEngine';
import {
  CAMPAIGN_FIELDS, ADSET_FIELDS, AD_FIELDS,
  VALID_OPTIMIZATION_GOALS, VALID_DESTINATION_TYPES,
  OPTIMIZATION_GOAL_LABELS, DESTINATION_TYPE_LABELS,
} from '../services/draft/MetaFieldRegistry';
import { extractMetaError } from '../utils/metaErrorHelper';

export const getHistory = async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 50));
    const jobs = await prisma.duplicateJob.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { profile: { select: { id: true, name: true } } },
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

    // Skip DRAFT_DUPLICATE entries — their targetId is a local draft ID, not a Meta object
    const metaJobs = jobs.filter(job => (job.details as any)?.operation !== 'DRAFT_DUPLICATE');

    let deletedCount = 0;
    const toDelete: string[] = [];
    for (let i = 0; i < metaJobs.length; i++) {
      if (i > 0) await sleep(150);
      const job = metaJobs[i];
      if (!job.targetId) continue;
      const exists = await fbService.checkExistence(job.targetId);
      if (!exists) toDelete.push(job.id);
    }
    if (toDelete.length > 0) {
      const result = await prisma.duplicateJob.deleteMany({
        where: { id: { in: toDelete }, userId: req.userId },
      });
      deletedCount = result.count;
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
    console.error('previewConversion Error:', error.response?.data || error.message);
    res.status(500).json({ message: extractMetaError(error, 'Failed to preview conversion') });
  }
};

export const convertObjective = async (req: AuthRequest, res: Response) => {
  const { items, targetObjective, newName, adAccountId, saveAsDraft } = req.body;
  const publishNow = saveAsDraft === false;

  if (!req.profileId) {
    return res.status(400).json({ message: 'No profile selected. Select a profile before converting.' });
  }
  const campaignItems = items.filter((i: any) => i.type === 'CAMPAIGN');
  if (campaignItems.length === 0) {
    return res.status(400).json({ message: 'Only campaigns can be converted. Select a campaign and try again.' });
  }

  try {
    const results = [];

    for (const item of campaignItems) {
      const finalName = (campaignItems.length === 1 && newName) ? newName : `${item.name} - Converted`;

      const draftCampaign = await DraftService.convertCampaignToDraft(
        item.id,
        targetObjective,
        finalName,
        adAccountId,
        req.profileId,
        req.userAccessToken!
      );

      // Publish failures must reach the user — the draft still exists, but
      // "Converted successfully" would be a lie if nothing was created on Meta.
      let publishError: string | undefined;
      if (publishNow) {
        try {
          await DraftPublishService.publishCampaign(draftCampaign.id, req.userAccessToken!);
        } catch (err: any) {
          publishError = err.userMessage || err.message;
          console.error(`Immediate publish failed for draft ${draftCampaign.id}:`, err.message);
        }
      }

      await prisma.duplicateJob.create({
        data: {
          userId: req.userId!,
          profileId: req.profileId || null,
          status: publishNow && publishError ? 'FAILED' : 'COMPLETED',
          type: 'CAMPAIGN',
          sourceId: item.id,
          targetId: draftCampaign.id,
          details: {
            newName: finalName, targetObjective, adAccountId, isConversion: true,
            savedAsDraft: !publishNow || !!publishError,
            ...(publishError ? { publishError } : {}),
          },
        },
      });
      results.push({ ...draftCampaign, publishError });
    }

    res.json({ success: true, results });
  } catch (error: any) {
    console.error('convertObjective Error:', error.response?.data || error.message);
    res.status(500).json({ message: extractMetaError(error, 'Failed to convert objective') });
  }
};

export const duplicateItems = async (req: AuthRequest, res: Response) => {
  const { items, adAccountId, options } = req.body;
  const numCopies = Number(options?.numCopies) || 1;

  const fbService = new FacebookService(req.userAccessToken!);
  const results: any[] = [];
  const failures: { itemId: string; iteration: number; error: string }[] = [];

  for (const item of items) {
    for (let i = 0; i < numCopies; i++) {
      try {
        const namingContext = {
          ...options.context,
          campaign_name: item.type === 'CAMPAIGN' ? item.name : undefined,
          adset_name: item.type === 'ADSET' ? item.name : undefined,
          ad_name: item.type === 'AD' ? item.name : undefined,
          iteration_number: i + 1,
          budget: options.customBudget ? parseFloat(options.customBudget) : undefined,
          date: new Date(),
        };

        const newName = NamingEngine.parse(options.renamePattern, namingContext);

        let customBudget = undefined;
        if (options.customBudget) {
          let budgetValue = parseFloat(options.customBudget);
          if (budgetValue > 0 && budgetValue < 40) budgetValue = 40;
          customBudget = (budgetValue * 100).toString();
        }

        let result;
        if (item.type === 'CAMPAIGN') {
          result = options.deep
            ? await fbService.duplicateCampaignDeep(item.id, newName, adAccountId, customBudget)
            : await fbService.duplicateCampaign(item.id, newName, adAccountId, customBudget);
        } else if (item.type === 'ADSET') {
          const originalResponse = await fbService.get(`/${item.id}`, { fields: 'campaign_id,campaign{id}' });
          const campaignId = originalResponse.data.campaign_id || originalResponse.data.campaign?.id;
          if (!campaignId) throw new Error(`Could not find parent campaign for ad set ${item.id}`);
          result = options.deep
            ? await fbService.duplicateAdSetDeep(item.id, newName, campaignId, adAccountId, customBudget)
            : await fbService.duplicateAdSet(item.id, newName, campaignId, adAccountId, customBudget);
        } else if (item.type === 'AD') {
          const original = await fbService.get(`/${item.id}`, { fields: 'adset_id' });
          result = await fbService.duplicateAd(item.id, newName, original.data.adset_id, adAccountId);
        }

        if (result) {
          await prisma.duplicateJob.create({
            data: {
              userId: req.userId!,
              profileId: req.profileId || null,
              status: 'COMPLETED',
              type: item.type,
              sourceId: item.id,
              targetId: result.id,
              details: { newName, adAccountId, options, iteration: i + 1 },
            },
          });
          results.push(result);
        }

        // Small inter-iteration pacing so Meta doesn't rate-limit a tight loop.
        if (i < numCopies - 1) await sleep(300);
      } catch (err: any) {
        const errMsg = extractMetaError(err, `Copy ${i + 1} failed`);
        console.error(`[DuplicationController] Copy ${i + 1}/${numCopies} of ${item.type} ${item.id} failed:`, errMsg);
        failures.push({ itemId: item.id, iteration: i + 1, error: errMsg });
        await prisma.duplicateJob.create({
          data: {
            userId: req.userId!,
            profileId: req.profileId || null,
            status: 'FAILED',
            type: item.type,
            sourceId: item.id,
            targetId: null,
            details: { error: errMsg, adAccountId, options, iteration: i + 1 },
          },
        });
      }
    }
  }

  const requested = items.length * numCopies;
  res.json({
    success: failures.length === 0,
    requested,
    created: results.length,
    failed: failures.length,
    results,
    failures,
  });
};

export const duplicateCampaign = async (req: AuthRequest, res: Response) => {
  const { campaignId, newName, adAccountId } = req.body;
  try {
    const fbService = new FacebookService(req.userAccessToken!);
    const result = await fbService.duplicateCampaign(campaignId, newName, adAccountId);

    await prisma.duplicateJob.create({
      data: {
        userId: req.userId!,
        profileId: req.profileId || null,
        status: 'COMPLETED',
        type: 'CAMPAIGN',
        sourceId: campaignId,
        targetId: result.id,
        details: { newName, adAccountId },
      },
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: extractMetaError(error, 'Failed to duplicate campaign') });
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
        profileId: req.profileId || null,
        status: 'COMPLETED',
        type: 'ADSET',
        sourceId: adSetId,
        targetId: result.id,
        details: { newName, campaignId, adAccountId },
      },
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: extractMetaError(error, 'Failed to duplicate ad set') });
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
        profileId: req.profileId || null,
        status: 'COMPLETED',
        type: 'AD',
        sourceId: adId,
        targetId: result.id,
        details: { newName, adSetId, adAccountId },
      },
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: extractMetaError(error, 'Failed to duplicate ad') });
  }
};

// ── Optimization endpoints ──

export const optimizeDuplicate = async (req: AuthRequest, res: Response) => {
  const { type, id, overrides } = req.body;
  try {
    const fbService = new FacebookService(req.userAccessToken!);

    if (type === 'CAMPAIGN') {
      const resp = await fbService.get(`/${id}`, {
        fields: 'name,objective,bid_strategy,buying_type,special_ad_categories,daily_budget,lifetime_budget,spend_cap',
      });
      const result = FieldOptimizationEngine.optimizeCampaignForDuplication(resp.data, overrides);

      const adSets = await fbService.getAdSets(id);
      const isCBO = !!(resp.data.daily_budget || resp.data.lifetime_budget);
      const adSetResults = [];
      const previewAdSets = adSets.slice(0, 5);
      for (let i = 0; i < previewAdSets.length; i++) {
        if (i > 0) await sleep(200);
        const adSet = previewAdSets[i];
        const fullAdSet = await fbService.get(`/${adSet.id}`, {
          fields: 'name,billing_event,optimization_goal,bid_amount,daily_budget,lifetime_budget,targeting,promoted_object,attribution_spec,destination_type,bid_strategy,start_time,end_time',
        });
        adSetResults.push({
          sourceId: adSet.id,
          sourceName: adSet.name,
          ...FieldOptimizationEngine.optimizeAdSetForDuplication(
            fullAdSet.data, resp.data.objective, isCBO, overrides?.adSet,
          ),
        });
      }

      return res.json({
        campaign: result,
        adSets: adSetResults,
        totalAdSets: adSets.length,
        schema: {
          campaign: CAMPAIGN_FIELDS,
          adSet: ADSET_FIELDS,
          optimizationGoals: VALID_OPTIMIZATION_GOALS,
          destinationTypes: VALID_DESTINATION_TYPES,
          goalLabels: OPTIMIZATION_GOAL_LABELS,
          destLabels: DESTINATION_TYPE_LABELS,
        },
      });
    }

    if (type === 'ADSET') {
      const resp = await fbService.get(`/${id}`, {
        fields: 'name,billing_event,optimization_goal,bid_amount,daily_budget,lifetime_budget,targeting,promoted_object,attribution_spec,destination_type,bid_strategy,start_time,end_time,campaign{id,objective,daily_budget,lifetime_budget}',
      });
      const data = resp.data;
      const campaignObjective = data.campaign?.objective || '';
      const isCBO = !!(data.campaign?.daily_budget || data.campaign?.lifetime_budget);
      const result = FieldOptimizationEngine.optimizeAdSetForDuplication(data, campaignObjective, isCBO, overrides);

      return res.json({
        adSet: result,
        campaignObjective,
        isCBO,
        schema: {
          adSet: ADSET_FIELDS,
          optimizationGoals: VALID_OPTIMIZATION_GOALS,
          destinationTypes: VALID_DESTINATION_TYPES,
          goalLabels: OPTIMIZATION_GOAL_LABELS,
          destLabels: DESTINATION_TYPE_LABELS,
        },
      });
    }

    if (type === 'AD') {
      const resp = await fbService.get(`/${id}`, { fields: 'name,creative,tracking_specs,status' });
      const result = FieldOptimizationEngine.optimizeAdForDuplication(resp.data, overrides);
      return res.json({ ad: result, schema: { ad: AD_FIELDS } });
    }

    return res.status(400).json({ message: 'Invalid type' });
  } catch (error: any) {
    console.error('[DuplicationController] optimizeDuplicate error:', error.response?.data || error.message);
    res.status(500).json({ message: extractMetaError(error, 'Failed to optimize') });
  }
};

export const optimizeConversion = async (req: AuthRequest, res: Response) => {
  const { type, id, targetObjective, newName } = req.body;
  try {
    const fbService = new FacebookService(req.userAccessToken!);

    if (type !== 'CAMPAIGN') {
      return res.status(400).json({ message: 'Only campaign conversion is supported' });
    }

    const resp = await fbService.get(`/${id}`, {
      fields: 'name,objective,bid_strategy,buying_type,special_ad_categories,daily_budget,lifetime_budget,spend_cap',
    });
    const campaignResult = FieldOptimizationEngine.optimizeCampaignForConversion(
      resp.data, targetObjective, newName || `${resp.data.name} - Converted`,
    );

    const isCBO = !!(campaignResult.payload.daily_budget || campaignResult.payload.lifetime_budget);

    const adSets = await fbService.getAdSets(id);
    const adSetResults = [];
    const previewAdSets = adSets.slice(0, 5);
    for (let i = 0; i < previewAdSets.length; i++) {
      if (i > 0) await sleep(200);
      const adSet = previewAdSets[i];
      const fullAdSet = await fbService.get(`/${adSet.id}`, {
        fields: 'name,billing_event,optimization_goal,bid_amount,daily_budget,lifetime_budget,targeting,promoted_object,attribution_spec,destination_type,bid_strategy,start_time,end_time',
      });

      let pageId: string | undefined = fullAdSet.data.promoted_object?.page_id;
      if (!pageId) {
        try {
          const ads = await fbService.getAds(adSet.id);
          if (ads.length > 0) {
            const adResp = await fbService.get(`/${ads[0].id}`, { fields: 'creative' });
            const creativeId = adResp.data.creative?.id;
            if (creativeId) {
              const creativeResp = await fbService.get(`/${creativeId}`, {
                fields: 'object_id,actor_id,object_story_spec',
              });
              const cr = creativeResp.data;
              pageId = cr.object_id || cr.actor_id || cr.object_story_spec?.page_id;
            }
          }
        } catch { /* ignore */ }
      }

      adSetResults.push({
        sourceId: adSet.id,
        sourceName: adSet.name,
        ...FieldOptimizationEngine.optimizeAdSetForConversion(
          fullAdSet.data, targetObjective, isCBO, pageId,
        ),
      });
    }

    return res.json({
      campaign: campaignResult,
      adSets: adSetResults,
      totalAdSets: adSets.length,
      sourceObjective: resp.data.objective,
      targetObjective,
      schema: {
        campaign: CAMPAIGN_FIELDS,
        adSet: ADSET_FIELDS,
        optimizationGoals: VALID_OPTIMIZATION_GOALS,
        destinationTypes: VALID_DESTINATION_TYPES,
        goalLabels: OPTIMIZATION_GOAL_LABELS,
        destLabels: DESTINATION_TYPE_LABELS,
      },
    });
  } catch (error: any) {
    console.error('[DuplicationController] optimizeConversion error:', error.response?.data || error.message);
    res.status(500).json({ message: extractMetaError(error, 'Failed to optimize conversion') });
  }
};

export const validateOptimization = async (req: AuthRequest, res: Response) => {
  const { entityType, payload, campaignObjective } = req.body;
  try {
    const result = FieldOptimizationEngine.validatePayload(entityType, payload, campaignObjective);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: 'Validation failed', error: error.message });
  }
};
