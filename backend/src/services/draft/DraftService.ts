import { prisma } from '../../prisma';
import { FacebookService } from '../facebook.service';
import { DraftStatus } from '@prisma/client';
import { ObjectiveConversionService } from '../objectiveConversion.service';
import { sleep } from '../../utils/sleep';

export class DraftService {
  static async duplicateCampaignToDraft(
    campaignId: string,
    userId: string,
    accessToken: string,
    options?: { iteration?: number }
  ) {
    // When the user requests multiple copies, this is called repeatedly with
    // iteration set so each draft gets a distinct name.
    const iteration = options?.iteration;
    const suffix = iteration && iteration > 0 ? ` ${iteration}` : '';
    const fbService = new FacebookService(accessToken);

    // 1. Fetch Campaign
    console.log(`[DraftService] Fetching source campaign: ${campaignId}`);
    let campaignData: any;
    try {
      const campaignResp = await fbService.get(`/${campaignId}`, {
        fields: 'name,objective,bid_strategy,buying_type,special_ad_categories,daily_budget,lifetime_budget,account_id'
      });
      campaignData = campaignResp.data;
    } catch (error: any) {
      console.error(`[DraftService] Failed to fetch source campaign ${campaignId}:`, error.response?.data || error.message);
      throw new Error(`Facebook API Error: ${error.response?.data?.error?.message || error.message}`);
    }

    const adAccountId = `act_${campaignData.account_id}`;
    console.log(`[DraftService] Source campaign found. adAccountId: ${adAccountId}`);

    // 2. Create Draft Campaign
    const draftCampaign = await prisma.draftCampaign.create({
      data: {
        userId,
        adAccountId,
        name: `${campaignData.name} - Internal Draft${suffix}`,
        objective: campaignData.objective,
        data: campaignData,
        status: DraftStatus.DRAFT,
      }
    });

    // 3. Fetch Ad Sets
    const adSets = await fbService.getAdSets(campaignId);

    for (let i = 0; i < adSets.length; i++) {
      if (i > 0) await sleep(300);
      const adSet = adSets[i];
      const draftAdSet = await prisma.draftAdSet.create({
        data: {
          userId,
          adAccountId,
          draftCampaignId: draftCampaign.id,
          name: `${adSet.name} - Internal Draft${suffix}`,
          data: adSet,
          status: DraftStatus.DRAFT,
        }
      });

      // 4. Fetch Ads
      const ads = await fbService.getAds(adSet.id);
      for (const ad of ads) {
        await prisma.draftAd.create({
          data: {
            userId,
            adAccountId,
            draftAdSetId: draftAdSet.id,
            name: `${ad.name} - Internal Draft${suffix}`,
            data: ad,
            status: DraftStatus.DRAFT,
          }
        });
      }
    }

    return draftCampaign;
  }
  static async convertCampaignToDraft(
    campaignId: string,
    targetObjective: string,
    newName: string,
    adAccountId: string,
    userId: string,
    accessToken: string
  ) {
    const fbService = new FacebookService(accessToken);
    const conversionService = new ObjectiveConversionService(fbService);

    // 1. Fetch original campaign
    const originalCampaign = await fbService.get(`/${campaignId}`, {
      fields: 'name,objective,bid_strategy,daily_budget,lifetime_budget,special_ad_categories,account_id'
    });
    const campaignData = originalCampaign.data;

    const normalizedAccountId = adAccountId.startsWith('act_')
      ? adAccountId
      : `act_${adAccountId}`;

    // 2. Transform campaign data (no Meta publish)
    const transformedCampaign = conversionService.transformCampaign(
      campaignData,
      targetObjective,
      newName
    );

    // 3. Save as Draft Campaign
    const draftCampaign = await prisma.draftCampaign.create({
      data: {
        userId,
        adAccountId: normalizedAccountId,
        name: newName,
        objective: targetObjective,
        data: transformedCampaign,
        status: DraftStatus.DRAFT,
      }
    });

    // 4. Fetch pixel_id for objectives that require it
    let pixelId: string | undefined;
    const NEEDS_PIXEL = new Set(['OUTCOME_SALES']);
    if (NEEDS_PIXEL.has(targetObjective)) {
      pixelId = await fbService.getPixelId(normalizedAccountId) || undefined;
      if (pixelId) {
        console.log(`[DraftService] Found pixel_id ${pixelId} for ${targetObjective} conversion`);
      }
    }

    // 5. Fetch and transform Ad Sets (getAdSets already returns all needed fields)
    const adSets = await fbService.getAdSets(campaignId);

    // If pixel_id not found from account, try to find it from source ad sets
    if (NEEDS_PIXEL.has(targetObjective) && !pixelId) {
      for (const adSet of adSets) {
        const foundPixel = adSet.promoted_object?.pixel_id;
        if (foundPixel) {
          pixelId = foundPixel;
          console.log(`[DraftService] Found pixel_id ${pixelId} from source ad set ${adSet.id}`);
          break;
        }
      }
      if (!pixelId) {
        console.warn(`[DraftService] No pixel_id found for ${targetObjective} — promoted_object will be incomplete. Edit the draft to add pixel_id before publishing.`);
      }
    }

    for (let i = 0; i < adSets.length; i++) {
      if (i > 0) await sleep(300);
      const adSet = adSets[i];
      const adSetData = adSet;

      // Fetch ads once, reuse for both page_id detection and draft creation
      const ads = await fbService.getAds(adSet.id);

      // Try to find page_id from promoted_object or creative
      let pageId: string | undefined = adSetData.promoted_object?.page_id;
      if (!pageId) {
        try {
          if (ads.length > 0 && ads[0].creative?.id) {
            const creativeResp = await fbService.get(`/${ads[0].creative.id}`, {
              fields: 'object_id,actor_id,object_story_spec'
            });
            const cr = creativeResp.data;
            pageId = cr.object_id || cr.actor_id || cr.object_story_spec?.page_id;
          }
        } catch (e) {
          console.warn(`[DraftService] Could not find page_id for ad set ${adSet.id}`);
        }
      }

      // For OUTCOME_SALES: promoted_object needs pixel_id + custom_event_type
      if (pixelId && NEEDS_PIXEL.has(targetObjective)) {
        adSetData.promoted_object = {
          pixel_id: pixelId,
          custom_event_type: 'PURCHASE',
        };
      }

      const transformedAdSet = conversionService.transformAdSet(
        adSetData,
        targetObjective,
        `${adSetData.name || 'Ad Set'} - Converted`,
        'PENDING_CAMPAIGN_ID',
        pageId
      );

      const draftAdSet = await prisma.draftAdSet.create({
        data: {
          userId,
          adAccountId: normalizedAccountId,
          draftCampaignId: draftCampaign.id,
          name: transformedAdSet.name,
          data: transformedAdSet,
          status: DraftStatus.DRAFT,
        }
      });

      for (const ad of ads) {
        const transformedAd = conversionService.transformAd(
          ad,
          targetObjective,
          `${ad.name || 'Ad'} - Converted`,
          'PENDING_ADSET_ID'
        );

        await prisma.draftAd.create({
          data: {
            userId,
            adAccountId: normalizedAccountId,
            draftAdSetId: draftAdSet.id,
            name: transformedAd.name,
            data: transformedAd,
            status: DraftStatus.DRAFT,
          }
        });
      }
    }

    return draftCampaign;
  }
}

