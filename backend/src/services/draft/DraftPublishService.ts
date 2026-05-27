import { prisma } from '../../prisma';
import { FacebookService } from '../facebook.service';
import { DraftStatus } from '@prisma/client';
import { withDbRetry } from '../../utils/dbRetry';
import {
  BID_CAP_STRATEGIES,
  COST_CAP_INCOMPATIBLE_GOALS,
  ATTRIBUTION_SPEC_OBJECTIVES,
  VALID_DESTINATION_TYPES,
  OBJECTIVE_DEFAULTS,
  PROMOTED_OBJECT_REQUIREMENTS,
  stripImmutableFields,
  sanitizeTargeting,
  sanitizePromotedObject,
  sanitizeTrackingSpecs,
} from './MetaFieldRegistry';
import { DraftValidationEngine } from './DraftValidationEngine';
import { extractMetaError, extractMetaErrorInfo } from '../../utils/metaErrorHelper';

const GOAL_BILLING_MAP: Record<string, string[]> = {
  LINK_CLICKS: ['IMPRESSIONS', 'LINK_CLICKS'],
  APP_INSTALLS: ['IMPRESSIONS', 'APP_INSTALLS'],
  PAGE_LIKES: ['IMPRESSIONS', 'PAGE_LIKES'],
  POST_ENGAGEMENT: ['IMPRESSIONS', 'POST_ENGAGEMENT'],
  THRUPLAY: ['IMPRESSIONS', 'THRUPLAY'],
};

export class PublishError extends Error {
  userMessage: string;
  constructor(detail: string, userMessage: string) {
    super(detail);
    this.userMessage = userMessage;
  }
}

function redactPayload(payload: any): any {
  const { targeting, ...rest } = payload;
  return targeting ? { ...rest, targeting: '[redacted]' } : rest;
}

// Fields Meta accepts when CREATING an asset_feed_spec for a Dynamic Creative ad.
// A GET on a live creative returns extra computed/read-only fields (e.g. `id`,
// `effective_*`, `optimization_type`, nested object ids) that Meta rejects on a
// create. We whitelist only the writable fields. `ad_formats` is required (inferred
// elsewhere) — it is included so an already-set value survives sanitization.
const ASSET_FEED_SPEC_WRITABLE_FIELDS = new Set([
  'bodies',
  'titles',
  'descriptions',
  'link_urls',
  'images',
  'videos',
  'call_to_action_types',
  'ad_formats',
]);

// Sub-object array fields whose individual entries may carry a read-only `id` from a
// GET. We keep the entries but strip the `id` so Meta treats them as new asset specs.
const ASSET_FEED_SUBOBJECT_ARRAYS = ['bodies', 'titles', 'descriptions', 'link_urls', 'images', 'videos'];

/**
 * Strip everything from a stored asset_feed_spec that Meta will not accept on a
 * Dynamic Creative ad create. Keeps only the writable fields and removes any
 * read-only `id` from each sub-object entry. Returns a NEW object — never mutates
 * the stored draft data.
 */
function sanitizeAssetFeedSpec(afs: any): any {
  if (!afs || typeof afs !== 'object') return afs;
  const cleaned: any = {};
  for (const key of Object.keys(afs)) {
    if (!ASSET_FEED_SPEC_WRITABLE_FIELDS.has(key)) continue;
    const value = afs[key];
    if (ASSET_FEED_SUBOBJECT_ARRAYS.includes(key) && Array.isArray(value)) {
      cleaned[key] = value.map((entry: any) => {
        if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
          const { id, ...rest } = entry;
          return rest;
        }
        return entry;
      });
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

/**
 * Strip read-only fields (`id`, any `effective_*` keys) from a stored
 * platform_customizations object fetched from Meta. Recurses into nested objects
 * and arrays so per-placement customizations are also cleaned. Returns a NEW object —
 * never mutates the stored draft data.
 */
function sanitizePlatformCustomizations(value: any): any {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizePlatformCustomizations(entry));
  }
  if (value && typeof value === 'object') {
    const cleaned: any = {};
    for (const key of Object.keys(value)) {
      if (key === 'id') continue;
      if (key.startsWith('effective_')) continue;
      cleaned[key] = sanitizePlatformCustomizations(value[key]);
    }
    return cleaned;
  }
  return value;
}

// Meta error code 3 (often surfaced as "(#3) Application does not have the capability
// to make this API call") means the FB App is in Development mode. Dynamic Creative
// inline creatives — like object_story_spec — require the app to be in Live mode.
const DEV_MODE_CAPABILITY_MESSAGE =
  'Dynamic Creative ads require the Facebook App to be in Live mode. Switch your app to Live mode in the Facebook Developer portal and try again.';

function isDevModeCapabilityError(error: any): boolean {
  const errData = error?.response?.data?.error;
  if (!errData) return false;
  if (errData.code === 3) return true;
  const msg: string = errData.message || '';
  return /does not have the capability/i.test(msg);
}

export class DraftPublishService {
  static async publishCampaign(campaignId: string, accessToken: string) {
    if (!accessToken) {
      throw new Error('No Facebook access token provided');
    }

    const fbService = new FacebookService(accessToken);
    const campaign = await withDbRetry(
      () => prisma.draftCampaign.findUnique({
        where: { id: campaignId },
        include: {
          adSets: {
            include: {
              ads: true,
            },
          },
        },
      }),
      'draftCampaign.findUnique',
    );

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
      const claimed = await withDbRetry(
        () => prisma.draftCampaign.updateMany({
          where: { id: campaignId, status: { not: DraftStatus.PUBLISHING } },
          data: { status: DraftStatus.PUBLISHING },
        }),
        'draftCampaign.claim(PUBLISHING)',
      );
      if (claimed.count === 0) {
        throw new PublishError(
          `Campaign ${campaignId} already publishing`,
          'This campaign is already being published.',
        );
      }

      const campaignData = campaign.data as any;
      const isCBO = this.detectCBO(campaignData);

      // Auto-fill special_ad_category_country from ad set targeting when missing
      const cats: string[] = campaignData.special_ad_categories || [];
      const hasSpecialCats = cats.length > 0 && !(cats.length === 1 && cats[0] === 'NONE');
      if (hasSpecialCats && (!campaignData.special_ad_category_country || campaignData.special_ad_category_country.length === 0)) {
        const countries = new Set<string>();
        for (const adSet of campaign.adSets) {
          const targeting = (adSet.data as any)?.targeting;
          const geoCountries: string[] = targeting?.geo_locations?.countries || [];
          geoCountries.forEach((c: string) => countries.add(c));
        }
        if (countries.size > 0) {
          campaignData.special_ad_category_country = Array.from(countries);
        }
      }

      let metaCampaignId: string;
      if (campaign.metaId) {
        metaCampaignId = campaign.metaId;

        const exists = await fbService.checkExistence(metaCampaignId);
        if (!exists) {
          console.warn(`[DraftPublishService] Meta campaign ${metaCampaignId} no longer exists, will recreate`);
          await withDbRetry(
            () => prisma.draftCampaign.update({
              where: { id: campaignId },
              data: { metaId: null },
            }),
            'draftCampaign.update(clear metaId)',
          );
          metaCampaignId = await this.createMetaCampaign(
            fbService, campaignAccountId, campaign.name, campaignData, isCBO
          );
          await withDbRetry(
            () => prisma.draftCampaign.update({
              where: { id: campaignId },
              data: { metaId: metaCampaignId },
            }),
            'draftCampaign.update(metaId after recreate)',
          );
        } else {
          const needsRecreate = await this.checkImmutableMismatch(fbService, metaCampaignId, campaignData);
          if (needsRecreate) {
            console.warn(`[DraftPublishService] Immutable field mismatch on ${metaCampaignId}, deleting and recreating`);
            await this.deleteMetaCampaign(fbService, metaCampaignId);
            await withDbRetry(
              () => prisma.draftCampaign.update({
                where: { id: campaignId },
                data: { metaId: null },
              }),
              'draftCampaign.update(clear metaId immutable mismatch)',
            );
            // Clear child metaIds — they were under the old campaign
            for (const adSet of campaign.adSets) {
              if (adSet.metaId) {
                await withDbRetry(
                  () => prisma.draftAdSet.update({ where: { id: adSet.id }, data: { metaId: null } }),
                  'draftAdSet.update(clear metaId)',
                );
                adSet.metaId = null;
              }
              for (const ad of adSet.ads) {
                if (ad.metaId) {
                  await withDbRetry(
                    () => prisma.draftAd.update({ where: { id: ad.id }, data: { metaId: null } }),
                    'draftAd.update(clear metaId)',
                  );
                  ad.metaId = null;
                }
              }
            }
            metaCampaignId = await this.createMetaCampaign(
              fbService, campaignAccountId, campaign.name, campaignData, isCBO
            );
            await withDbRetry(
              () => prisma.draftCampaign.update({
                where: { id: campaignId },
                data: { metaId: metaCampaignId },
              }),
              'draftCampaign.update(metaId after immutable recreate)',
            );
          } else {
            await this.updateMetaCampaign(fbService, metaCampaignId, campaign.name, campaignData, isCBO);
          }
        }
      } else {
        metaCampaignId = await this.createMetaCampaign(
          fbService, campaignAccountId, campaign.name, campaignData, isCBO
        );
        await withDbRetry(
          () => prisma.draftCampaign.update({
            where: { id: campaignId },
            data: { metaId: metaCampaignId },
          }),
          'draftCampaign.update(metaId fresh create)',
        );
      }

      for (const adSet of campaign.adSets) {
        await withDbRetry(
          () => prisma.draftAdSet.update({
            where: { id: adSet.id },
            data: { status: DraftStatus.PUBLISHING },
          }),
          'draftAdSet.update(PUBLISHING)',
        );

        const adSetAccountId = normalizeAccountId(adSet.adAccountId);

        let metaAdSetId: string;
        if (adSet.metaId) {
          const exists = await fbService.checkExistence(adSet.metaId);
          if (!exists) {
            console.warn(`[DraftPublishService] Meta ad set ${adSet.metaId} no longer exists, will recreate`);
            await withDbRetry(
              () => prisma.draftAdSet.update({
                where: { id: adSet.id },
                data: { metaId: null },
              }),
              'draftAdSet.update(clear metaId)',
            );
            metaAdSetId = await this.createMetaAdSet(
              fbService, adSetAccountId, adSet, metaCampaignId, campaignData, isCBO
            );
            await withDbRetry(
              () => prisma.draftAdSet.update({
                where: { id: adSet.id },
                data: { metaId: metaAdSetId },
              }),
              'draftAdSet.update(metaId after recreate)',
            );
          } else {
            metaAdSetId = adSet.metaId;
            await this.updateMetaAdSet(fbService, metaAdSetId, adSet, campaignData, isCBO);
          }
        } else {
          metaAdSetId = await this.createMetaAdSet(
            fbService, adSetAccountId, adSet, metaCampaignId, campaignData, isCBO
          );
          await withDbRetry(
            () => prisma.draftAdSet.update({
              where: { id: adSet.id },
              data: { metaId: metaAdSetId },
            }),
            'draftAdSet.update(metaId fresh create)',
          );
        }

        await withDbRetry(
          () => prisma.draftAdSet.update({
            where: { id: adSet.id },
            data: { status: DraftStatus.PUBLISHED },
          }),
          'draftAdSet.update(PUBLISHED)',
        );

        for (const ad of adSet.ads) {
          await withDbRetry(
            () => prisma.draftAd.update({
              where: { id: ad.id },
              data: { status: DraftStatus.PUBLISHING },
            }),
            'draftAd.update(PUBLISHING)',
          );

          const adAccountId = normalizeAccountId(ad.adAccountId);

          let metaAdId: string;
          if (ad.metaId) {
            const exists = await fbService.checkExistence(ad.metaId);
            if (!exists) {
              console.warn(`[DraftPublishService] Meta ad ${ad.metaId} no longer exists, will recreate`);
              await withDbRetry(
                () => prisma.draftAd.update({
                  where: { id: ad.id },
                  data: { metaId: null },
                }),
                'draftAd.update(clear metaId)',
              );
              metaAdId = await this.createMetaAd(fbService, adAccountId, ad, metaAdSetId, adSet);
              await withDbRetry(
                () => prisma.draftAd.update({
                  where: { id: ad.id },
                  data: { metaId: metaAdId },
                }),
                'draftAd.update(metaId after recreate)',
              );
            } else {
              metaAdId = ad.metaId;
            }
          } else {
            metaAdId = await this.createMetaAd(fbService, adAccountId, ad, metaAdSetId, adSet);
            await withDbRetry(
              () => prisma.draftAd.update({
                where: { id: ad.id },
                data: { metaId: metaAdId },
              }),
              'draftAd.update(metaId fresh create)',
            );
          }

          await withDbRetry(
            () => prisma.draftAd.update({
              where: { id: ad.id },
              data: { status: DraftStatus.PUBLISHED },
            }),
            'draftAd.update(PUBLISHED)',
          );
        }
      }

      await withDbRetry(
        () => prisma.draftCampaign.update({
          where: { id: campaignId },
          data: { status: DraftStatus.PUBLISHED },
        }),
        'draftCampaign.update(PUBLISHED)',
      );

      return { success: true, metaCampaignId };
    } catch (error: any) {
      console.error('Publishing failed:', error.message);

      await withDbRetry(
        () => prisma.draftCampaign.update({
          where: { id: campaignId },
          data: { status: DraftStatus.FAILED },
        }),
        'draftCampaign.update(FAILED)',
      );
      await withDbRetry(
        () => prisma.draftAdSet.updateMany({
          where: { draftCampaignId: campaignId, status: DraftStatus.PUBLISHING },
          data: { status: DraftStatus.FAILED },
        }),
        'draftAdSet.updateMany(FAILED)',
      );
      const adSetIds = campaign.adSets.map((s) => s.id);
      if (adSetIds.length > 0) {
        await withDbRetry(
          () => prisma.draftAd.updateMany({
            where: { draftAdSetId: { in: adSetIds }, status: DraftStatus.PUBLISHING },
            data: { status: DraftStatus.FAILED },
          }),
          'draftAd.updateMany(FAILED)',
        );
      }

      await withDbRetry(
        () => prisma.draftPublishLog.create({
          data: {
            draftId: campaignId,
            draftType: 'CAMPAIGN',
            status: 'FAILED',
            error: error.message,
          },
        }),
        'draftPublishLog.create',
      );

      // Best-effort cleanup of any Meta objects created before the failure.
      // Fire-and-forget — we don't want cleanup errors to mask the original.
      this.cleanupOrphanedMetaObjects(campaignId, accessToken).catch((cleanupErr) => {
        console.warn('[DraftPublishService] Auto-cleanup after failure also failed:', cleanupErr.message);
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

  private static async checkImmutableMismatch(
    fbService: FacebookService,
    metaCampaignId: string,
    campaignData: any,
  ): Promise<boolean> {
    try {
      const resp = await fbService.client.get(`/${metaCampaignId}`, { params: { fields: 'objective,buying_type' } });
      const meta = resp.data;
      if (meta.objective && meta.objective !== campaignData.objective) return true;
      const metaBuyingType = meta.buying_type || 'AUCTION';
      const draftBuyingType = campaignData.buying_type || 'AUCTION';
      if (metaBuyingType !== draftBuyingType) return true;
      return false;
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
    const rawCategories: string[] = campaignData.special_ad_categories || [];
    let migratedCategories = rawCategories.map((c: string) =>
      c === 'CREDIT' ? 'FINANCIAL_PRODUCTS_SERVICES' : c
    ).filter((c: string, i: number, a: string[]) => a.indexOf(c) === i);
    // NONE must not coexist with real categories
    if (migratedCategories.length > 1) {
      migratedCategories = migratedCategories.filter((c: string) => c !== 'NONE');
    }

    const campaignPayload: any = {
      name,
      objective: campaignData.objective,
      status: 'PAUSED',
      special_ad_categories: migratedCategories,
    };

    const hasSpecialCategories = migratedCategories.length > 0 &&
      !(migratedCategories.length === 1 && migratedCategories[0] === 'NONE');
    if (hasSpecialCategories && campaignData.special_ad_category_country?.length > 0) {
      campaignPayload.special_ad_category_country = campaignData.special_ad_category_country;
    }

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

    console.log(`[DraftPublishService] Creating campaign:`, JSON.stringify(redactPayload(campaignPayload)));
    try {
      const fbCampaign = await fbService.client.post(`/${accountId}/campaigns`, campaignPayload);
      return fbCampaign.data.id;
    } catch (error: any) {
      throw this.toPublishError(error, 'Campaign');
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
    const rawCats: string[] = campaignData.special_ad_categories || [];
    let migratedCats = rawCats.map((c: string) =>
      c === 'CREDIT' ? 'FINANCIAL_PRODUCTS_SERVICES' : c
    ).filter((c: string, i: number, a: string[]) => a.indexOf(c) === i);
    if (migratedCats.length > 1) {
      migratedCats = migratedCats.filter((c: string) => c !== 'NONE');
    }

    const updatePayload: any = {
      name,
      status: 'PAUSED',
      special_ad_categories: migratedCats,
    };

    const hasSpecialCats = migratedCats.length > 0 &&
      !(migratedCats.length === 1 && migratedCats[0] === 'NONE');
    if (hasSpecialCats && campaignData.special_ad_category_country?.length > 0) {
      updatePayload.special_ad_category_country = campaignData.special_ad_category_country;
    }

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
        if (BID_CAP_STRATEGIES.has(campaignData.bid_strategy)) {
          if (campaignData.bid_amount) {
            updatePayload.bid_amount = String(campaignData.bid_amount);
          } else {
            updatePayload.bid_strategy = 'LOWEST_COST_WITHOUT_CAP';
          }
        }
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

    console.log(`[DraftPublishService] Updating existing Meta campaign ${metaCampaignId}:`, JSON.stringify(redactPayload(cleaned)));
    try {
      await fbService.client.post(`/${metaCampaignId}`, cleaned);
    } catch (error: any) {
      console.error(`[DraftPublishService] Failed to update Meta campaign ${metaCampaignId}:`, error.response?.data?.error || error.message);
      throw this.toPublishError(error, 'Campaign update');
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
    if (requiredPromotedFields.length > 0) {
      if (!cleanPromotedObject) {
        throw new Error(
          `promoted_object with ${requiredPromotedFields.join(' or ')} is required for ${campaignObjective}`
        );
      }
      const hasRequired = requiredPromotedFields.some((f: string) => cleanPromotedObject[f]);
      if (!hasRequired) {
        throw new Error(
          `promoted_object must include ${requiredPromotedFields.join(' or ')} for ${campaignObjective}`
        );
      }
    }

    // FIX: Use shared sanitizeTargeting
    const targeting = sanitizeTargeting(adSetData.targeting);
    this.resolveTargetingConflicts(targeting);

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

    // Determine effective bid strategy to constrain billing_event and optimization_goal
    const effectiveBidStrategy = isCBO ? campaignData.bid_strategy : adSetData.bid_strategy;

    let optimizationGoal = adSetData.optimization_goal;
    let resolvedBidStrategy = effectiveBidStrategy;
    if (effectiveBidStrategy === 'COST_CAP' && COST_CAP_INCOMPATIBLE_GOALS.has(optimizationGoal)) {
      console.warn(`[DraftPublishService] COST_CAP incompatible with ${optimizationGoal}, falling back to LOWEST_COST_WITHOUT_CAP`);
      resolvedBidStrategy = 'LOWEST_COST_WITHOUT_CAP';
    }

    const resolvedIsBidCap = BID_CAP_STRATEGIES.has(resolvedBidStrategy);

    // COST_CAP / bid-cap strategies require billing_event: IMPRESSIONS
    let billingEvent: string;
    if (resolvedIsBidCap) {
      billingEvent = 'IMPRESSIONS';
    } else {
      const allowedBilling = GOAL_BILLING_MAP[optimizationGoal] || ['IMPRESSIONS'];
      billingEvent = allowedBilling.includes(adSetData.billing_event) ? adSetData.billing_event : 'IMPRESSIONS';
    }

    // APP destination_type requires promoted_object with application_id
    if (destinationType === 'APP' && campaignObjective !== 'OUTCOME_APP_PROMOTION') {
      if (!cleanPromotedObject?.application_id) {
        throw new Error(
          'APP destination type requires promoted_object with application_id'
        );
      }
    }

    // APP_PROMOTION requires object_store_url in promoted_object
    if (campaignObjective === 'OUTCOME_APP_PROMOTION' && cleanPromotedObject?.application_id && !cleanPromotedObject.object_store_url) {
      throw new Error(
        'App Promotion campaigns require object_store_url in promoted_object (e.g. App Store or Play Store URL)'
      );
    }

    const adSetPayload: any = {
      name: adSet.name,
      campaign_id: metaCampaignId,
      status: 'PAUSED',
      billing_event: billingEvent,
      optimization_goal: optimizationGoal,
      targeting,
    };

    if (adSetData.is_dynamic_creative !== undefined) {
      adSetPayload.is_dynamic_creative = !!adSetData.is_dynamic_creative;
    }

    if (adSetData.dsa_beneficiary) adSetPayload.dsa_beneficiary = adSetData.dsa_beneficiary;
    if (adSetData.dsa_payor) adSetPayload.dsa_payor = adSetData.dsa_payor;

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
      // Use resolved strategy (falls back from COST_CAP when goal is incompatible)
      const adSetBidStrategy: string | undefined = resolvedBidStrategy !== effectiveBidStrategy
        ? resolvedBidStrategy
        : adSetData.bid_strategy;
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
        // Both set — pick daily, lifetime requires end_time which may be missing
        adSetPayload.daily_budget = String(adSetDailyBudget);
      } else if (adSetDailyBudget > 0) {
        adSetPayload.daily_budget = String(adSetDailyBudget);
      } else if (adSetLifetimeBudget > 0) {
        if (!adSetData.end_time) {
          throw new PublishError(
            `Ad set "${adSet.name}" uses lifetime_budget but has no end_time`,
            'Lifetime budget requires an End Time. Set an end date in the ad set Schedule section, or switch to Daily Budget.',
          );
        }
        adSetPayload.lifetime_budget = String(adSetLifetimeBudget);
      }
      if (adSetData.start_time) adSetPayload.start_time = adSetData.start_time;
      if (adSetData.end_time) adSetPayload.end_time = adSetData.end_time;
    } else {
      // CBO: campaign owns the budget, but bid_amount still applies at ad set level
      const campBidStrategy = campaignData.bid_strategy;
      if (campBidStrategy && BID_CAP_STRATEGIES.has(campBidStrategy)) {
        adSetPayload.bid_amount = String(adSetData.bid_amount || campaignData.bid_amount);
      }
    }

    console.log(`[DraftPublishService] Creating ad set ${adSet.id}:`, JSON.stringify(redactPayload(adSetPayload)));
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
            throw this.toPublishError(retryError2, 'Ad Set');
          }
        }
      }

      throw this.toPublishError(error, 'Ad Set');
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
    this.resolveTargetingConflicts(targeting);

    const effectiveBidStrategyUpd = isCBO ? campaignData.bid_strategy : adSetData.bid_strategy;
    const isBidCapUpd = BID_CAP_STRATEGIES.has(effectiveBidStrategyUpd);

    let billingEventUpd: string;
    if (isBidCapUpd) {
      billingEventUpd = 'IMPRESSIONS';
    } else {
      const allowedBillingUpd = (GOAL_BILLING_MAP[adSetData.optimization_goal] || ['IMPRESSIONS']);
      billingEventUpd = allowedBillingUpd.includes(adSetData.billing_event) ? adSetData.billing_event : 'IMPRESSIONS';
    }

    const updatePayload: any = {
      name: adSet.name,
      status: 'PAUSED',
      billing_event: billingEventUpd,
      optimization_goal: adSetData.optimization_goal,
      targeting,
    };

    if (adSetData.dsa_beneficiary) updatePayload.dsa_beneficiary = adSetData.dsa_beneficiary;
    if (adSetData.dsa_payor) updatePayload.dsa_payor = adSetData.dsa_payor;

    // Include attribution_spec if supported
    if (adSetData.attribution_spec && ATTRIBUTION_SPEC_OBJECTIVES.has(campaignObjective)) {
      updatePayload.attribution_spec = adSetData.attribution_spec;
    }

    if (!isCBO) {
      if (adSetData.bid_strategy) {
        if (BID_CAP_STRATEGIES.has(adSetData.bid_strategy) && adSetData.bid_amount) {
          updatePayload.bid_strategy = adSetData.bid_strategy;
          updatePayload.bid_amount = String(adSetData.bid_amount);
        } else if (BID_CAP_STRATEGIES.has(adSetData.bid_strategy) && !adSetData.bid_amount) {
          updatePayload.bid_strategy = 'LOWEST_COST_WITHOUT_CAP';
        } else {
          updatePayload.bid_strategy = adSetData.bid_strategy;
        }
      }
      const adSetDailyBudget = Number(adSetData.daily_budget) || 0;
      const adSetLifetimeBudget = Number(adSetData.lifetime_budget) || 0;
      if (adSetDailyBudget > 0) updatePayload.daily_budget = String(adSetDailyBudget);
      else if (adSetLifetimeBudget > 0) {
        if (!adSetData.end_time) {
          throw new PublishError(
            `Ad set "${adSet.name}" uses lifetime_budget but has no end_time`,
            'Lifetime budget requires an End Time. Set an end date in the ad set Schedule section, or switch to Daily Budget.',
          );
        }
        updatePayload.lifetime_budget = String(adSetLifetimeBudget);
      }
      if (adSetData.start_time) updatePayload.start_time = adSetData.start_time;
      if (adSetData.end_time) updatePayload.end_time = adSetData.end_time;
    } else {
      const campBidStrategy = campaignData.bid_strategy;
      if (campBidStrategy && BID_CAP_STRATEGIES.has(campBidStrategy)) {
        updatePayload.bid_amount = String(adSetData.bid_amount || campaignData.bid_amount);
      }
    }

    const { cleaned, stripped } = stripImmutableFields('adSet', updatePayload);
    /* v8 ignore next 2 */
    if (stripped.length > 0) {
      console.warn(`[DraftPublishService] Stripped immutable fields from ad set update: ${stripped.join(', ')}`);
    }

    console.log(`[DraftPublishService] Updating existing Meta ad set ${metaAdSetId}:`, JSON.stringify(redactPayload(cleaned)));
    try {
      await fbService.client.post(`/${metaAdSetId}`, cleaned);
    } catch (error: any) {
      console.error(`[DraftPublishService] Failed to update Meta ad set ${metaAdSetId}:`, error.response?.data?.error || error.message);
      throw error;
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

    // creative_id: explicitly set by user to reference a specific Meta creative
    // existingMetaCreativeId: comes from fetched live ad data (creative.id from Meta Graph API)
    const explicitCreativeId = adData.creative?.creative_id;
    const existingMetaCreativeId = adData.creative?.id;
    const creativeId = explicitCreativeId || existingMetaCreativeId;
    const hasInlineCreative = adData.creative?.object_story_spec;
    const hasAssetFeed = adData.creative?.asset_feed_spec;
    const hasPlatformCustomizations = adData.creative?.platform_customizations;

    if (!creativeId && !hasInlineCreative && !hasAssetFeed) {
      throw new Error(`Ad "${ad.name}" is missing creative_id or object_story_spec — cannot publish without a creative`);
    }

    let creative: any;
    const effectiveDestType = adSet?.metaId && adSet?.data?._original_destination_type !== undefined
      ? adSet?.data?._original_destination_type
      : adSet?.data?.destination_type;
    const isMessengerDest = ['MESSENGER', 'WHATSAPP', 'INSTAGRAM_DIRECT'].includes(effectiveDestType);
    const forceInline = isMessengerDest && hasInlineCreative;

    // Dynamic Creative ad sets only accept Dynamic Creative ads (error 100/1885702:
    // "Only Dynamic Creative ad can be created since the Ad Set is Dynamic Creative Ad Set.").
    // A DC ad set rejects BOTH a plain creative_id reference AND a pre-created adcreative
    // object (the latter also fails in dev mode with "(#3) Application does not have the
    // capability to make this API call."). The only path that works is an INLINE creative
    // embedded directly in the ad's `creative` field, built from asset_feed_spec + page_id
    // (+ platform_customizations), with is_dynamic_creative: true on the ad payload.
    //
    // When the stored creative is a "post-backed dynamic creative" (it has BOTH asset_feed_spec
    // AND object_story_spec), Meta uses object_story_spec to provide the post format while
    // asset_feed_spec provides the dynamic elements. Omitting object_story_spec in that case
    // causes error 100/2490497 ("You must select an existing post or create a post for your ad
    // creative."), so we must include it. (Per CLAUDE.md, object_story_spec requires the FB app
    // to be in Live mode — in dev mode this will fail with a self-explanatory app-mode error,
    // which is expected and acceptable.) When there is no stored object_story_spec, we omit it.
    const isDynamicCreativeAdSet = !!adSet?.data?.is_dynamic_creative;

    // DC ad set + stored asset_feed_spec → build the inline dynamic creative. This branch
    // takes priority over the creative_id shortcut below because a DC ad set cannot reference
    // a standalone creative.
    if (isDynamicCreativeAdSet && hasAssetFeed) {
      const pageId = adSet?.data?.promoted_object?.page_id
        || adSet?.data?.page_id
        || adData.page_id
        || adData.creative?.page_id
        || adData.creative?.object_story_spec?.page_id;

      // A stored asset_feed_spec fetched from Meta's GET carries computed/read-only fields
      // (e.g. `id`, `effective_*`, `optimization_type`, per-asset `id`s) that Meta rejects on
      // create. Whitelist only the writable fields and drop read-only sub-object ids. This
      // returns a NEW object, so the stored draft data is not mutated.
      const afs = sanitizeAssetFeedSpec(adData.creative.asset_feed_spec);
      if (afs.call_to_action_types?.length > 5) {
        console.log(`[DraftPublishService] Trimming call_to_action_types from ${afs.call_to_action_types.length} to 5 (Meta limit)`);
        afs.call_to_action_types = afs.call_to_action_types.slice(0, 5);
      }

      // Meta requires asset_feed_spec to declare exactly one ad format (error 100/1885374:
      // "An asset feed can have exactly one ad format."). Infer it from the stored post format
      // when not already set by stored data.
      if (!afs.ad_formats) {
        const oss = adData.creative.object_story_spec;
        if (oss?.video_data) afs.ad_formats = ['SINGLE_VIDEO'];
        else afs.ad_formats = ['SINGLE_IMAGE'];
      }

      // Inline creative for a Dynamic Creative ad: asset_feed_spec + page_id only.
      // We deliberately DO NOT send object_story_spec. A stored object_story_spec fetched from
      // Meta is a computed/read-only representation of the ad's post format — Meta surfaces it
      // to describe the post but rejects it on ad creation (error 100/1443048: "Object story
      // spec is ill formed..."). With asset_feed_spec.ad_formats present, object_story_spec is
      // not needed; its absence does NOT trigger the earlier 100/2490497 ("must select an
      // existing post") because that error was actually caused by the missing ad_formats.
      creative = { asset_feed_spec: afs };
      if (pageId) creative.page_id = String(pageId);
      if (adData.creative.platform_customizations) {
        // platform_customizations from a GET also carries read-only fields (`id`, `effective_*`).
        // Strip them so Meta accepts the inline creative in Live mode.
        creative.platform_customizations = sanitizePlatformCustomizations(adData.creative.platform_customizations);
      }
      console.log(`[DraftPublishService] Building inline dynamic creative for ad ${ad.id} (DC ad set, asset_feed_spec only)`);
    }
    // If the ad was duplicated from a live Meta campaign, it will have both creative.id (the
    // existing Meta creative) and asset_feed_spec in its data. Re-creating the dynamic creative
    // may fail if the app lacks the required capability. Prefer the existing creative ID.
    else if (existingMetaCreativeId && hasAssetFeed && !forceInline) {
      console.log(`[DraftPublishService] Using existing creative_id ${existingMetaCreativeId} for ad ${ad.id} (skipping asset_feed_spec pre-creation)`);
      creative = { creative_id: String(existingMetaCreativeId) };
    } else if (hasAssetFeed) {
      const pageId = adSet?.data?.promoted_object?.page_id
        || adSet?.data?.page_id
        || adData.page_id
        || adData.creative?.page_id
        || adData.creative?.object_story_spec?.page_id;

      const afs = { ...adData.creative.asset_feed_spec };
      if (afs.call_to_action_types?.length > 5) {
        console.log(`[DraftPublishService] Trimming call_to_action_types from ${afs.call_to_action_types.length} to 5 (Meta limit)`);
        afs.call_to_action_types = afs.call_to_action_types.slice(0, 5);
      }
      if (afs.images?.length > 10) afs.images = afs.images.slice(0, 10);
      if (afs.bodies?.length > 5) afs.bodies = afs.bodies.slice(0, 5);
      if (afs.titles?.length > 5) afs.titles = afs.titles.slice(0, 5);
      // Meta requires exactly one ad format per asset feed.
      // If ad_formats has multiple values, keep the first one.
      // If ad_formats is absent but both images and videos exist, pick whichever
      // has more assets and drop the other to avoid the 1885374 error.
      if (afs.ad_formats?.length > 1) {
        console.log(`[DraftPublishService] Trimming ad_formats from ${afs.ad_formats.length} to 1 (Meta allows exactly one)`);
        afs.ad_formats = afs.ad_formats.slice(0, 1);
      }
      if (!afs.ad_formats && afs.images?.length && afs.videos?.length) {
        const keepImages = afs.images.length >= afs.videos.length;
        console.log(`[DraftPublishService] Mixed image+video assets — keeping ${keepImages ? 'images' : 'videos'} (${keepImages ? afs.images.length : afs.videos.length} assets)`);
        if (keepImages) {
          delete afs.videos;
          afs.ad_formats = ['SINGLE_IMAGE'];
        } else {
          delete afs.images;
          afs.ad_formats = ['SINGLE_VIDEO'];
        }
      }

      // asset_feed_spec and object_story_spec are mutually exclusive formats.
      // When using asset_feed_spec, page_id goes at the top level, not inside object_story_spec.
      const adCreativePayload: any = {
        name: `${ad.name} Creative`,
        page_id: String(pageId),
        asset_feed_spec: afs,
      };
      if (adData.creative.platform_customizations) {
        adCreativePayload.platform_customizations = adData.creative.platform_customizations;
      }

      console.log(`[DraftPublishService] Pre-creating adcreative for ad ${ad.id} (asset_feed_spec)`);
      try {
        const fbCreative = await fbService.client.post(`/${accountId}/adcreatives`, adCreativePayload);
        creative = { creative_id: String(fbCreative.data.id) };
      } catch (error: any) {
        throw this.toPublishError(error, 'Ad Creative');
      }
    } else if (hasPlatformCustomizations) {
      // Platform customizations require either asset_feed_spec (handled above) or object_story_spec
      if (hasInlineCreative) {
        const storySpec = { ...adData.creative.object_story_spec };
        creative = { object_story_spec: storySpec };
      } else {
        creative = {};
      }
    } else if (creativeId && !forceInline) {
      creative = { creative_id: String(creativeId) };
    } else if (hasInlineCreative) {
      const storySpec = { ...adData.creative.object_story_spec };
      creative = { object_story_spec: storySpec };
    } else {
      creative = {};
    }

    // Ensure identity (page_id, instagram_actor_id) is set for inline creatives
    if (!creative.creative_id) {
      const pageId = adSet?.data?.promoted_object?.page_id
        || adSet?.data?.page_id
        || adData.page_id
        || adData.creative?.page_id
        || adData.creative?.object_story_spec?.page_id;

      const instagramActorId = adData.creative?.instagram_actor_id
        || adData.instagram_actor_id
        || adSet?.data?.promoted_object?.instagram_actor_id
        || adSet?.data?.instagram_actor_id
        || (hasAssetFeed ? undefined : (adData.creative?.object_story_spec?.instagram_actor_id || adData.creative?.object_story_spec?.instagram_user_id));

      if (pageId && !creative.page_id) {
        creative.page_id = String(pageId);
      }

      // Legacy support: object_story_spec requires identity fields
      if (creative.object_story_spec) {
        if (pageId && !creative.object_story_spec.page_id) {
          creative.object_story_spec.page_id = String(pageId);
        }
      }

      // Only inject Instagram identity if explicitly provided in ad or ad set.
      // If blank, Meta will auto-resolve from the Page, which avoids strict Actor ID validation.
      if (instagramActorId) {
        if (!creative.instagram_actor_id) {
          creative.instagram_actor_id = String(instagramActorId);
        }
        if (!creative.instagram_user_id) {
          creative.instagram_user_id = String(instagramActorId);
        }

        // Legacy support: object_story_spec
        if (creative.object_story_spec && !creative.object_story_spec.instagram_user_id) {
          creative.object_story_spec.instagram_user_id = String(instagramActorId);
        }
      }
    }

    if (hasPlatformCustomizations && !hasAssetFeed) {
      creative.platform_customizations = adData.creative.platform_customizations;
    }
    
    delete creative.creative_type;

    const adPayload: any = {
      name: ad.name,
      adset_id: metaAdSetId,
      status: 'PAUSED',
      creative,
    };

    // Dynamic Creative ad sets require each ad to also declare is_dynamic_creative: true.
    // Without this — and without the inline asset_feed_spec creative built above — Meta
    // rejects the ad with error 100/1885702. The flag lives on the parent ad set's draft data.
    if (isDynamicCreativeAdSet) {
      adPayload.is_dynamic_creative = true;
    }

    if (adData.tracking_specs) {
      adPayload.tracking_specs = sanitizeTrackingSpecs(adData.tracking_specs);
    }

    if (adData.url_parameters) {
      adPayload.url_parameters = adData.url_parameters;
    }

    console.log(`[DraftPublishService] Creating ad ${ad.id}:`, JSON.stringify(redactPayload(adPayload)));
    try {
      const fbAd = await fbService.client.post(`/${accountId}/ads`, adPayload);
      return fbAd.data.id;
    } catch (error: any) {
      // Dynamic Creative inline creatives are gated to Live mode. A dev-mode app returns
      // error code 3 ("(#3) Application does not have the capability to make this API call.").
      // Surface a clear, actionable message instead of the raw Meta error.
      if (isDynamicCreativeAdSet && isDevModeCapabilityError(error)) {
        const info = extractMetaErrorInfo(error, 'Ad');
        throw new PublishError(info.detail, DEV_MODE_CAPABILITY_MESSAGE);
      }
      throw this.toPublishError(error, 'Ad');
    }
  }

  // ─── Error helpers ───

  private static toPublishError(error: any, entity: string): PublishError {
    const info = extractMetaErrorInfo(error, `${entity} error`);
    return new PublishError(info.detail, info.userMessage);
  }

  // ─── Targeting conflict resolution ───

  private static resolveTargetingConflicts(targeting: any): void {
    // Default targeting_automation when missing
    if (!targeting.targeting_automation) {
      targeting.targeting_automation = { advantage_audience: 0 };
    }

    const isAdvantageAudience = targeting.targeting_automation?.advantage_audience === 1;

    if (isAdvantageAudience) {
      // Advantage+ audience caps age_min at 25
      if (targeting.age_min > 25) {
        targeting.targeting_automation.advantage_audience = 0;
      }
      // Advantage+ audience doesn't support manual publisher_platforms
      if (targeting.publisher_platforms) {
        targeting.targeting_automation.advantage_audience = 0;
      }
      // Advantage+ audience doesn't support narrow gender targeting
      const genders: string[] = targeting.genders || [];
      if (genders.length > 0 && !(genders.length === 1 && String(genders[0]) === '0')) {
        targeting.targeting_automation.advantage_audience = 0;
      }
    }

    // genders: ["0"] means "all" — Meta may reject it on create, safer to omit
    const genders: string[] = targeting.genders || [];
    if (genders.length === 1 && String(genders[0]) === '0') {
      delete targeting.genders;
    }

    // messenger/audience_network require facebook as a co-platform
    const platforms: string[] = targeting.publisher_platforms || [];
    if (platforms.length > 0 && !platforms.includes('facebook')) {
      const needsFacebook = platforms.some((p: string) =>
        p === 'messenger' || p === 'audience_network'
      );
      if (needsFacebook) {
        targeting.publisher_platforms = ['facebook', ...platforms];
      }
    }
  }

  // ─── Cleanup ───

  static async cleanupOrphanedMetaObjects(campaignId: string, accessToken: string): Promise<{ deleted: string[] }> {
    const fbService = new FacebookService(accessToken);
    const campaign = await withDbRetry(
      () => prisma.draftCampaign.findUnique({
        where: { id: campaignId },
        include: { adSets: { include: { ads: true } } },
      }),
      'draftCampaign.findUnique(cleanup)',
    );

    if (!campaign) throw new Error('Draft not found');
    const deleted: string[] = [];

    for (const adSet of campaign.adSets) {
      for (const ad of adSet.ads) {
        if (ad.metaId) {
          try {
            await fbService.client.post(`/${ad.metaId}`, { status: 'DELETED' });
            deleted.push(`ad:${ad.metaId}`);
          } catch { /* already gone */ }
          await withDbRetry(
            () => prisma.draftAd.update({ where: { id: ad.id }, data: { metaId: null, status: DraftStatus.DRAFT } }),
            'draftAd.update(cleanup)',
          );
        }
      }
      if (adSet.metaId) {
        try {
          await fbService.client.post(`/${adSet.metaId}`, { status: 'DELETED' });
          deleted.push(`adset:${adSet.metaId}`);
        } catch { /* already gone */ }
        await withDbRetry(
          () => prisma.draftAdSet.update({ where: { id: adSet.id }, data: { metaId: null, status: DraftStatus.DRAFT } }),
          'draftAdSet.update(cleanup)',
        );
      }
    }

    if (campaign.metaId) {
      try {
        await fbService.client.post(`/${campaign.metaId}`, { status: 'DELETED' });
        deleted.push(`campaign:${campaign.metaId}`);
      } catch { /* already gone */ }
      await withDbRetry(
        () => prisma.draftCampaign.update({ where: { id: campaignId }, data: { metaId: null, status: DraftStatus.DRAFT } }),
        'draftCampaign.update(cleanup)',
      );
    }

    return { deleted };
  }
}
