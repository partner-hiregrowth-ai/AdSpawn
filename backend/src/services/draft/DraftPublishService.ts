import { prisma } from '../../prisma';
import { FacebookService } from '../facebook.service';
import { DraftStatus } from '@prisma/client';
import {
  BID_CAP_STRATEGIES,
  ATTRIBUTION_SPEC_OBJECTIVES,
  VALID_DESTINATION_TYPES,
  OBJECTIVE_DEFAULTS,
  PROMOTED_OBJECT_REQUIREMENTS,
  stripImmutableFields,
  sanitizeTargeting,
  sanitizePromotedObject,
} from './MetaFieldRegistry';
import { DraftValidationEngine } from './DraftValidationEngine';
import { extractMetaError } from '../../utils/metaErrorHelper';

export class DraftPublishService {
  static async publishCampaign(campaignId: string, accessToken: string) {
    if (!accessToken) {
      throw new Error('No Facebook access token provided');
    }

    const fbService = new FacebookService(accessToken);
    const campaign = await prisma.draftCampaign.findUnique({
      where: { id: campaignId },
      include: {
        adSets: {
          include: {
            ads: true,
          },
        },
      },
    });

    if (!campaign) throw new Error('Campaign draft not found');

    const validation = await DraftValidationEngine.validateFullDraft(campaign);
    if (!validation.isValid) {
      const allErrors = [
        ...validation.campaignErrors,
        ...Object.values(validation.adSetErrors).flat(),
        ...Object.values(validation.adErrors).flat(),
      ].filter(e => e.severity === 'error');

      throw new Error(
        `Validation failed: ${allErrors.map(e => `[${e.field}] ${e.message}`).join('; ')}`
      );
    }

    const normalizeAccountId = (id: string) =>
      id.startsWith('act_') ? id : `act_${id}`;

    const campaignAccountId = normalizeAccountId(campaign.adAccountId);

    try {
      await prisma.draftCampaign.update({
        where: { id: campaignId },
        data: { status: DraftStatus.PUBLISHING },
      });

      const campaignData = campaign.data as any;
      const isCBO = this.detectCBO(campaignData);

      let metaCampaignId: string;
      if (campaign.metaId) {
        metaCampaignId = campaign.metaId;

        const exists = await fbService.checkExistence(metaCampaignId);
        if (!exists) {
          console.warn(`[DraftPublishService] Meta campaign ${metaCampaignId} no longer exists, will recreate`);
          await prisma.draftCampaign.update({
            where: { id: campaignId },
            data: { metaId: null },
          });
          metaCampaignId = await this.createMetaCampaign(
            fbService, campaignAccountId, campaign.name, campaignData, isCBO
          );
          await prisma.draftCampaign.update({
            where: { id: campaignId },
            data: { metaId: metaCampaignId },
          });
        } else {
          // Check if objective matches — objective is immutable on Meta
          const needsRecreate = await this.checkObjectiveMismatch(fbService, metaCampaignId, campaignData.objective);
          if (needsRecreate) {
            console.warn(`[DraftPublishService] Objective mismatch on ${metaCampaignId}, deleting and recreating`);
            await this.deleteMetaCampaign(fbService, metaCampaignId);
            await prisma.draftCampaign.update({
              where: { id: campaignId },
              data: { metaId: null },
            });
            // Clear child metaIds — they were under the old campaign
            for (const adSet of campaign.adSets) {
              if (adSet.metaId) {
                await prisma.draftAdSet.update({ where: { id: adSet.id }, data: { metaId: null } });
                adSet.metaId = null;
              }
              for (const ad of adSet.ads) {
                if (ad.metaId) {
                  await prisma.draftAd.update({ where: { id: ad.id }, data: { metaId: null } });
                  ad.metaId = null;
                }
              }
            }
            metaCampaignId = await this.createMetaCampaign(
              fbService, campaignAccountId, campaign.name, campaignData, isCBO
            );
            await prisma.draftCampaign.update({
              where: { id: campaignId },
              data: { metaId: metaCampaignId },
            });
          } else {
            await this.updateMetaCampaign(fbService, metaCampaignId, campaign.name, campaignData, isCBO);
          }
        }
      } else {
        metaCampaignId = await this.createMetaCampaign(
          fbService, campaignAccountId, campaign.name, campaignData, isCBO
        );
        await prisma.draftCampaign.update({
          where: { id: campaignId },
          data: { metaId: metaCampaignId },
        });
      }

      for (const adSet of campaign.adSets) {
        await prisma.draftAdSet.update({
          where: { id: adSet.id },
          data: { status: DraftStatus.PUBLISHING },
        });

        const adSetAccountId = normalizeAccountId(adSet.adAccountId);

        let metaAdSetId: string;
        if (adSet.metaId) {
          const exists = await fbService.checkExistence(adSet.metaId);
          if (!exists) {
            console.warn(`[DraftPublishService] Meta ad set ${adSet.metaId} no longer exists, will recreate`);
            await prisma.draftAdSet.update({
              where: { id: adSet.id },
              data: { metaId: null },
            });
            metaAdSetId = await this.createMetaAdSet(
              fbService, adSetAccountId, adSet, metaCampaignId, campaignData, isCBO
            );
            await prisma.draftAdSet.update({
              where: { id: adSet.id },
              data: { metaId: metaAdSetId },
            });
          } else {
            metaAdSetId = adSet.metaId;
            await this.updateMetaAdSet(fbService, metaAdSetId, adSet, campaignData, isCBO);
          }
        } else {
          metaAdSetId = await this.createMetaAdSet(
            fbService, adSetAccountId, adSet, metaCampaignId, campaignData, isCBO
          );
          await prisma.draftAdSet.update({
            where: { id: adSet.id },
            data: { metaId: metaAdSetId },
          });
        }

        await prisma.draftAdSet.update({
          where: { id: adSet.id },
          data: { status: DraftStatus.PUBLISHED },
        });

        for (const ad of adSet.ads) {
          await prisma.draftAd.update({
            where: { id: ad.id },
            data: { status: DraftStatus.PUBLISHING },
          });

          const adAccountId = normalizeAccountId(ad.adAccountId);

          let metaAdId: string;
          if (ad.metaId) {
            const exists = await fbService.checkExistence(ad.metaId);
            if (!exists) {
              console.warn(`[DraftPublishService] Meta ad ${ad.metaId} no longer exists, will recreate`);
              await prisma.draftAd.update({
                where: { id: ad.id },
                data: { metaId: null },
              });
              metaAdId = await this.createMetaAd(fbService, adAccountId, ad, metaAdSetId, adSet);
              await prisma.draftAd.update({
                where: { id: ad.id },
                data: { metaId: metaAdId },
              });
            } else {
              metaAdId = ad.metaId;
            }
          } else {
            metaAdId = await this.createMetaAd(fbService, adAccountId, ad, metaAdSetId, adSet);
            await prisma.draftAd.update({
              where: { id: ad.id },
              data: { metaId: metaAdId },
            });
          }

          await prisma.draftAd.update({
            where: { id: ad.id },
            data: { status: DraftStatus.PUBLISHED },
          });
        }
      }

      await prisma.draftCampaign.update({
        where: { id: campaignId },
        data: { status: DraftStatus.PUBLISHED },
      });

      return { success: true, metaCampaignId };
    } catch (error: any) {
      console.error('Publishing failed:', error.message);

      await prisma.draftCampaign.update({
        where: { id: campaignId },
        data: { status: DraftStatus.FAILED },
      });
      await prisma.draftAdSet.updateMany({
        where: { draftCampaignId: campaignId, status: DraftStatus.PUBLISHING },
        data: { status: DraftStatus.FAILED },
      });
      const adSetIds = campaign.adSets.map((s) => s.id);
      if (adSetIds.length > 0) {
        await prisma.draftAd.updateMany({
          where: { draftAdSetId: { in: adSetIds }, status: DraftStatus.PUBLISHING },
          data: { status: DraftStatus.FAILED },
        });
      }

      await prisma.draftPublishLog.create({
        data: {
          draftId: campaignId,
          draftType: 'CAMPAIGN',
          status: 'FAILED',
          error: error.message,
        },
      });

      throw error;
    }
  }

  // ─── CBO Detection ───
  // CBO = campaign has budget AND controls budget distribution (not adset-level)
  private static detectCBO(campaignData: any): boolean {
    if (campaignData.is_adset_budget_sharing_enabled === true) return true;
    if (campaignData.is_adset_budget_sharing_enabled === false) return false;
    const hasCampaignBudget =
      (Number(campaignData.daily_budget) > 0) ||
      (Number(campaignData.lifetime_budget) > 0);
    return hasCampaignBudget;
  }

  private static async checkObjectiveMismatch(
    fbService: FacebookService,
    metaCampaignId: string,
    targetObjective: string,
  ): Promise<boolean> {
    try {
      const resp = await fbService.client.get(`/${metaCampaignId}`, { params: { fields: 'objective' } });
      const metaObjective = resp.data.objective;
      return metaObjective && metaObjective !== targetObjective;
    } catch {
      return false;
    }
  }

  private static async deleteMetaCampaign(
    fbService: FacebookService,
    metaCampaignId: string,
  ): Promise<void> {
    try {
      await fbService.client.delete(`/${metaCampaignId}`);
    } catch (error: any) {
      console.warn(`[DraftPublishService] Failed to delete stale campaign ${metaCampaignId}:`, error.message);
    }
  }

  // ─── Campaign Create ───

  private static async createMetaCampaign(
    fbService: FacebookService,
    accountId: string,
    name: string,
    campaignData: any,
    isCBO: boolean,
  ): Promise<string> {
    const campaignPayload: any = {
      name,
      objective: campaignData.objective,
      status: 'PAUSED',
      special_ad_categories: campaignData.special_ad_categories || [],
    };

    if (campaignData.buying_type) {
      campaignPayload.buying_type = campaignData.buying_type;
    }

    if (isCBO) {
      if (campaignData.daily_budget && campaignData.lifetime_budget) {
        campaignPayload.daily_budget = String(campaignData.daily_budget);
      } else if (campaignData.daily_budget) {
        campaignPayload.daily_budget = String(campaignData.daily_budget);
      } else if (campaignData.lifetime_budget) {
        campaignPayload.lifetime_budget = String(campaignData.lifetime_budget);
      }

      if (campaignData.bid_strategy) {
        campaignPayload.bid_strategy = campaignData.bid_strategy;
        if (BID_CAP_STRATEGIES.has(campaignData.bid_strategy) && campaignData.bid_amount) {
          campaignPayload.bid_amount = String(campaignData.bid_amount);
        }
      } else {
        campaignPayload.bid_strategy = 'LOWEST_COST_WITHOUT_CAP';
      }
    } else {
      campaignPayload.is_adset_budget_sharing_enabled = false;
    }

    if (campaignData.spend_cap && Number(campaignData.spend_cap) > 0) {
      campaignPayload.spend_cap = String(campaignData.spend_cap);
    }

    console.log(`[DraftPublishService] Creating campaign:`, JSON.stringify(campaignPayload));
    try {
      const fbCampaign = await fbService.client.post(`/${accountId}/campaigns`, campaignPayload);
      return fbCampaign.data.id;
    } catch (error: any) {
      throw new Error(extractMetaError(error, 'Facebook API Error (Campaign)'));
    }
  }

  // ─── Campaign Update ───

  private static async updateMetaCampaign(
    fbService: FacebookService,
    metaCampaignId: string,
    name: string,
    campaignData: any,
    isCBO: boolean,
  ): Promise<void> {
    const updatePayload: any = {
      name,
      status: 'PAUSED',
      special_ad_categories: campaignData.special_ad_categories || [],
    };

    if (isCBO) {
      if (campaignData.daily_budget && !campaignData.lifetime_budget) {
        updatePayload.daily_budget = String(campaignData.daily_budget);
      } else if (campaignData.lifetime_budget && !campaignData.daily_budget) {
        updatePayload.lifetime_budget = String(campaignData.lifetime_budget);
      } else if (campaignData.daily_budget) {
        updatePayload.daily_budget = String(campaignData.daily_budget);
      }

      if (campaignData.bid_strategy) {
        updatePayload.bid_strategy = campaignData.bid_strategy;
      }
    }

    if (campaignData.spend_cap && Number(campaignData.spend_cap) > 0) {
      updatePayload.spend_cap = String(campaignData.spend_cap);
    }

    const { cleaned, stripped } = stripImmutableFields('campaign', updatePayload);
    /* v8 ignore next 2 */
    if (stripped.length > 0) {
      console.warn(`[DraftPublishService] Stripped immutable fields from campaign update: ${stripped.join(', ')}`);
    }

    console.log(`[DraftPublishService] Updating existing Meta campaign ${metaCampaignId}:`, JSON.stringify(cleaned));
    try {
      await fbService.client.post(`/${metaCampaignId}`, cleaned);
    } catch (error: any) {
      console.error(`[DraftPublishService] Failed to update Meta campaign ${metaCampaignId}:`, error.response?.data?.error || error.message);
    }
  }

  // ─── Ad Set Create ───

  private static async createMetaAdSet(
    fbService: FacebookService,
    accountId: string,
    adSet: any,
    metaCampaignId: string,
    campaignData: any,
    isCBO: boolean,
  ): Promise<string> {
    const adSetData = adSet.data as any;
    const campaignObjective: string = campaignData.objective || '';

    // FIX: Use shared sanitizePromotedObject and validate required fields
    const cleanPromotedObject = sanitizePromotedObject(adSetData.promoted_object);
    const requiredPromotedFields = PROMOTED_OBJECT_REQUIREMENTS[campaignObjective] || [];
    if (requiredPromotedFields.length > 0 && cleanPromotedObject) {
      const hasRequired = requiredPromotedFields.some((f: string) => cleanPromotedObject[f]);
      if (!hasRequired) {
        throw new Error(
          `promoted_object must include ${requiredPromotedFields.join(' or ')} for ${campaignObjective}`
        );
      }
    }

    // FIX: Use shared sanitizeTargeting
    const targeting = sanitizeTargeting(adSetData.targeting);

    // destination_type — infer from optimization_goal for ENGAGEMENT, validate for others
    const validDestTypes = VALID_DESTINATION_TYPES[campaignObjective] || [];
    let destinationType: string | undefined;
    if (campaignObjective === 'OUTCOME_ENGAGEMENT') {
      const goal = adSetData.optimization_goal;
      if (goal === 'POST_ENGAGEMENT') destinationType = 'ON_POST';
      else if (goal === 'VIDEO_VIEWS' || goal === 'THRUPLAY') destinationType = 'ON_VIDEO';
      else if (goal === 'MESSAGES') destinationType = 'FACEBOOK';
      else destinationType = 'WEBSITE';
    } else if (campaignObjective === 'OUTCOME_AWARENESS') {
      // AWARENESS only supports UNDEFINED (= omit from payload)
    } else if (adSetData.destination_type && adSetData.destination_type !== 'UNDEFINED' && validDestTypes.includes(adSetData.destination_type)) {
      destinationType = adSetData.destination_type;
    } else {
      const defaultDest = OBJECTIVE_DEFAULTS[campaignObjective]?.destination_type;
      if (defaultDest && defaultDest !== 'UNDEFINED') {
        destinationType = defaultDest;
      }
    }

    const adSetPayload: any = {
      name: adSet.name,
      campaign_id: metaCampaignId,
      status: 'PAUSED',
      billing_event: adSetData.billing_event || 'IMPRESSIONS',
      optimization_goal: adSetData.optimization_goal,
      targeting,
    };

    if (cleanPromotedObject) {
      // SALES requires custom_event_type with pixel_id
      if (campaignObjective === 'OUTCOME_SALES' && cleanPromotedObject.pixel_id && !cleanPromotedObject.custom_event_type) {
        cleanPromotedObject.custom_event_type = 'PURCHASE';
      }
      adSetPayload.promoted_object = cleanPromotedObject;
    }

    if (destinationType) {
      adSetPayload.destination_type = destinationType;
    }

    // Only include attribution_spec for objectives that support it
    if (adSetData.attribution_spec && ATTRIBUTION_SPEC_OBJECTIVES.has(campaignObjective)) {
      adSetPayload.attribution_spec = adSetData.attribution_spec;
    }

    if (!isCBO) {
      const adSetBidStrategy: string | undefined = adSetData.bid_strategy;
      const adSetBidAmount: number | string | undefined = adSetData.bid_amount;

      if (adSetBidStrategy) {
        if (BID_CAP_STRATEGIES.has(adSetBidStrategy) && adSetBidAmount) {
          adSetPayload.bid_strategy = adSetBidStrategy;
          adSetPayload.bid_amount = String(adSetBidAmount);
        } else if (BID_CAP_STRATEGIES.has(adSetBidStrategy) && !adSetBidAmount) {
          adSetPayload.bid_strategy = 'LOWEST_COST_WITHOUT_CAP';
        } else {
          adSetPayload.bid_strategy = adSetBidStrategy;
        }
      } else {
        adSetPayload.bid_strategy = 'LOWEST_COST_WITHOUT_CAP';
      }

      const adSetDailyBudget = Number(adSetData.daily_budget) || 0;
      const adSetLifetimeBudget = Number(adSetData.lifetime_budget) || 0;
      if (adSetDailyBudget > 0 && adSetLifetimeBudget > 0) {
        adSetPayload.daily_budget = String(adSetDailyBudget);
      } else if (adSetDailyBudget > 0) {
        adSetPayload.daily_budget = String(adSetDailyBudget);
      } else if (adSetLifetimeBudget > 0) {
        adSetPayload.lifetime_budget = String(adSetLifetimeBudget);
        if (adSetData.end_time) {
          adSetPayload.end_time = adSetData.end_time;
        }
      }
      if (adSetData.start_time) adSetPayload.start_time = adSetData.start_time;
      if (adSetData.end_time) adSetPayload.end_time = adSetData.end_time;
    }

    console.log(`[DraftPublishService] Creating ad set ${adSet.id}:`, JSON.stringify(adSetPayload));
    try {
      const fbAdSet = await fbService.client.post(`/${accountId}/adsets`, adSetPayload);
      return fbAdSet.data.id;
    } catch (error: any) {
      const errData = error.response?.data?.error;
      console.error(`[DraftPublishService] Ad set creation failed:`, JSON.stringify(errData) || error.message);

      // Retry on bid-related errors
      const bidConflictSubcodes = new Set([2490487, 1815857, 1885621]);
      if (bidConflictSubcodes.has(errData?.error_subcode)) {
        // Strategy 1: Force LOWEST_COST_WITHOUT_CAP (doesn't need bid_amount)
        const retryPayload = { ...adSetPayload };
        retryPayload.bid_strategy = 'LOWEST_COST_WITHOUT_CAP';
        delete retryPayload.bid_amount;
        delete retryPayload.bid_constraints;
        console.log(`[DraftPublishService] Retrying ad set ${adSet.id} with LOWEST_COST_WITHOUT_CAP (bid conflict fix)`);
        try {
          const fbAdSetRetry = await fbService.client.post(`/${accountId}/adsets`, retryPayload);
          console.warn(`[DraftPublishService] Ad set ${adSet.id} published with LOWEST_COST_WITHOUT_CAP fallback — bid_strategy was reset`);
          return fbAdSetRetry.data.id;
        } catch (retryError1: any) {
          // Strategy 2: Strip all budget/bid fields (true CBO conflict)
          const bidlessPayload = { ...adSetPayload };
          delete bidlessPayload.bid_strategy;
          delete bidlessPayload.bid_amount;
          delete bidlessPayload.bid_constraints;
          delete bidlessPayload.daily_budget;
          delete bidlessPayload.lifetime_budget;
          console.log(`[DraftPublishService] Retrying ad set ${adSet.id} without budget/bid fields (CBO fallback)`);
          try {
            const fbAdSetRetry2 = await fbService.client.post(`/${accountId}/adsets`, bidlessPayload);
            console.warn(`[DraftPublishService] Ad set ${adSet.id} published without budget — CBO fallback used`);
            return fbAdSetRetry2.data.id;
          } catch (retryError2: any) {
            throw new Error(extractMetaError(retryError2, `Facebook API Error (AdSet ${adSet.id})`));
          }
        }
      }

      throw new Error(extractMetaError(error, `Facebook API Error (AdSet ${adSet.id})`));
    }
  }

  // ─── Ad Set Update ───

  private static async updateMetaAdSet(
    fbService: FacebookService,
    metaAdSetId: string,
    adSet: any,
    campaignData: any,
    isCBO: boolean,
  ): Promise<void> {
    const adSetData = adSet.data as any;
    const campaignObjective = campaignData?.objective || '';
    const targeting = sanitizeTargeting(adSetData.targeting);

    const updatePayload: any = {
      name: adSet.name,
      status: 'PAUSED',
      billing_event: adSetData.billing_event || 'IMPRESSIONS',
      optimization_goal: adSetData.optimization_goal,
      targeting,
    };

    // Include attribution_spec if supported
    if (adSetData.attribution_spec && ATTRIBUTION_SPEC_OBJECTIVES.has(campaignObjective)) {
      updatePayload.attribution_spec = adSetData.attribution_spec;
    }

    if (!isCBO) {
      if (adSetData.bid_strategy) updatePayload.bid_strategy = adSetData.bid_strategy;
      if (adSetData.bid_amount) updatePayload.bid_amount = String(adSetData.bid_amount);
      const adSetDailyBudget = Number(adSetData.daily_budget) || 0;
      const adSetLifetimeBudget = Number(adSetData.lifetime_budget) || 0;
      if (adSetDailyBudget > 0) updatePayload.daily_budget = String(adSetDailyBudget);
      else if (adSetLifetimeBudget > 0) updatePayload.lifetime_budget = String(adSetLifetimeBudget);
      if (adSetData.start_time) updatePayload.start_time = adSetData.start_time;
      if (adSetData.end_time) updatePayload.end_time = adSetData.end_time;
    }

    const { cleaned, stripped } = stripImmutableFields('adSet', updatePayload);
    /* v8 ignore next 2 */
    if (stripped.length > 0) {
      console.warn(`[DraftPublishService] Stripped immutable fields from ad set update: ${stripped.join(', ')}`);
    }

    console.log(`[DraftPublishService] Updating existing Meta ad set ${metaAdSetId}:`, JSON.stringify(cleaned));
    try {
      await fbService.client.post(`/${metaAdSetId}`, cleaned);
    } catch (error: any) {
      console.error(`[DraftPublishService] Failed to update Meta ad set ${metaAdSetId}:`, error.response?.data?.error || error.message);
    }
  }

  // ─── Ad Create ───

  private static async createMetaAd(
    fbService: FacebookService,
    accountId: string,
    ad: any,
    metaAdSetId: string,
    adSet?: any,
  ): Promise<string> {
    const adData = ad.data as any;

    const creativeId = adData.creative?.creative_id || adData.creative?.id;
    const hasInlineCreative = adData.creative?.object_story_spec;

    if (!creativeId && !hasInlineCreative) {
      throw new Error(`Ad "${ad.name}" is missing creative_id or object_story_spec — cannot publish without a creative`);
    }

    let creative: any;
    if (creativeId) {
      creative = { creative_id: String(creativeId) };
    } else {
      const storySpec = { ...adData.creative.object_story_spec };
      // Meta requires page_id in object_story_spec
      if (!storySpec.page_id) {
        const pageId = adSet?.data?.promoted_object?.page_id
          || adSet?.data?.page_id
          || adData.page_id;
        if (pageId) {
          storySpec.page_id = String(pageId);
        }
      }
      creative = { object_story_spec: storySpec };
    }

    const adPayload: any = {
      name: ad.name,
      adset_id: metaAdSetId,
      status: 'PAUSED',
      creative,
    };

    if (adData.tracking_specs) {
      adPayload.tracking_specs = adData.tracking_specs;
    }

    if (adData.url_parameters) {
      adPayload.url_parameters = adData.url_parameters;
    }

    console.log(`[DraftPublishService] Creating ad ${ad.id}:`, JSON.stringify(adPayload));
    try {
      const fbAd = await fbService.client.post(`/${accountId}/ads`, adPayload);
      return fbAd.data.id;
    } catch (error: any) {
      throw new Error(extractMetaError(error, `Facebook API Error (Ad ${ad.id})`));
    }
  }

  // ─── Cleanup ───

  static async cleanupOrphanedMetaObjects(campaignId: string, accessToken: string): Promise<{ deleted: string[] }> {
    const fbService = new FacebookService(accessToken);
    const campaign = await prisma.draftCampaign.findUnique({
      where: { id: campaignId },
      include: { adSets: { include: { ads: true } } },
    });

    if (!campaign) throw new Error('Draft not found');
    const deleted: string[] = [];

    for (const adSet of campaign.adSets) {
      for (const ad of adSet.ads) {
        if (ad.metaId) {
          try {
            await fbService.client.post(`/${ad.metaId}`, { status: 'DELETED' });
            deleted.push(`ad:${ad.metaId}`);
          } catch { /* already gone */ }
          await prisma.draftAd.update({ where: { id: ad.id }, data: { metaId: null, status: DraftStatus.DRAFT } });
        }
      }
      if (adSet.metaId) {
        try {
          await fbService.client.post(`/${adSet.metaId}`, { status: 'DELETED' });
          deleted.push(`adset:${adSet.metaId}`);
        } catch { /* already gone */ }
        await prisma.draftAdSet.update({ where: { id: adSet.id }, data: { metaId: null, status: DraftStatus.DRAFT } });
      }
    }

    if (campaign.metaId) {
      try {
        await fbService.client.post(`/${campaign.metaId}`, { status: 'DELETED' });
        deleted.push(`campaign:${campaign.metaId}`);
      } catch { /* already gone */ }
      await prisma.draftCampaign.update({ where: { id: campaignId }, data: { metaId: null, status: DraftStatus.DRAFT } });
    }

    return { deleted };
  }
}
