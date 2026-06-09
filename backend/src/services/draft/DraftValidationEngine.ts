import { DraftCampaign, DraftAdSet, DraftAd } from '@prisma/client';
import {
  VALID_OPTIMIZATION_GOALS,
  VALID_DESTINATION_TYPES,
  VALID_BUYING_TYPES,
  PROMOTED_OBJECT_REQUIREMENTS,
  ATTRIBUTION_SPEC_OBJECTIVES,
  BID_CAP_STRATEGIES,
  COST_CAP_INCOMPATIBLE_GOALS,
  IMMUTABLE_CAMPAIGN_FIELDS,
  IMMUTABLE_ADSET_FIELDS,
  OPTIMIZATION_GOAL_LABELS,
  DESTINATION_TYPE_LABELS,
} from './MetaFieldRegistry';

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

// ─── Friendly label helpers ───

const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_AWARENESS: 'Awareness', OUTCOME_TRAFFIC: 'Traffic',
  OUTCOME_ENGAGEMENT: 'Engagement', OUTCOME_LEADS: 'Leads',
  OUTCOME_SALES: 'Sales', OUTCOME_APP_PROMOTION: 'App Promotion',
};

const BID_STRATEGY_LABELS: Record<string, string> = {
  LOWEST_COST_WITHOUT_CAP: 'Highest Volume',
  LOWEST_COST_WITH_BID_CAP: 'Bid Cap',
  COST_CAP: 'Cost Per Result Goal',
  LOWEST_COST_WITH_MIN_ROAS: 'ROAS Goal',
};

const PROMOTED_OBJECT_FIELD_LABELS: Record<string, string> = {
  pixel_id: 'Meta Pixel', page_id: 'Facebook Page', application_id: 'App ID',
};

const FIELD_LABELS: Record<string, string> = {
  buying_type: 'Buying Type', objective: 'Objective',
  destination_type: 'Destination Type', promoted_object: 'Promoted Object',
  is_dynamic_creative: 'Dynamic Creative', campaign_id: 'Campaign',
};

function labelObj(obj: string): string { return OBJECTIVE_LABELS[obj] || obj; }
function labelGoal(g: string): string { return OPTIMIZATION_GOAL_LABELS[g] || g; }
function labelDest(d: string): string { return DESTINATION_TYPE_LABELS[d] || d; }
function labelBid(b: string): string { return BID_STRATEGY_LABELS[b] || b; }
function labelField(f: string): string { return FIELD_LABELS[f] || f.replace(/_/g, ' '); }
function labelPromoted(f: string): string { return PROMOTED_OBJECT_FIELD_LABELS[f] || f; }

// Meta enforces a per-day minimum that varies by currency. Without knowing the
// account currency we use a heuristic floor in the smallest currency unit.
const MIN_DAILY_BUDGET_FLOOR = 2000;

export class DraftValidationEngine {
  static async validateCampaign(campaign: DraftCampaign): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    const data = campaign.data as any;

    if (!campaign.name) {
      errors.push({ field: 'name', message: 'Campaign name is required.', severity: 'error' });
    }

    const objective = data.objective || campaign.objective;
    if (!objective) {
      errors.push({ field: 'objective', message: 'Campaign objective is required.', severity: 'error' });
    }

    if (!VALID_OPTIMIZATION_GOALS[objective] && objective) {
      errors.push({ field: 'objective', message: `"${objective}" is not a recognized campaign objective.`, severity: 'error' });
    }

    if (objective && data.buying_type) {
      const validBuyingTypes = VALID_BUYING_TYPES[objective] || ['AUCTION'];
      if (!validBuyingTypes.includes(data.buying_type)) {
        errors.push({
          field: 'buying_type',
          message: `${data.buying_type === 'RESERVED' ? 'Reach & Frequency' : data.buying_type} buying type is not available for ${labelObj(objective)} campaigns. Only ${validBuyingTypes.map((b: string) => b === 'RESERVED' ? 'Reach & Frequency' : b).join(', ')} is supported.`,
          severity: 'error',
        });
      }
    }

    const hasDailyBudget = data.daily_budget && Number(data.daily_budget) > 0;
    const hasLifetimeBudget = data.lifetime_budget && Number(data.lifetime_budget) > 0;
    if (hasDailyBudget && hasLifetimeBudget) {
      errors.push({
        field: 'budget',
        message: 'Choose either Daily Budget or Lifetime Budget — you cannot use both at the same time.',
        severity: 'error',
      });
    }

    if (data.bid_strategy && BID_CAP_STRATEGIES.has(data.bid_strategy)) {
      if (!data.bid_amount) {
        errors.push({
          field: 'bid_strategy',
          message: `${labelBid(data.bid_strategy)} requires a bid amount. Set a bid amount or switch to Highest Volume.`,
          severity: 'error',
        });
      }
    }

    // CBO enabled but no campaign budget
    const isCBO = hasDailyBudget || hasLifetimeBudget;
    if (!isCBO && data.is_adset_budget_sharing_enabled === true) {
      errors.push({
        field: 'budget',
        message: 'Campaign Budget Optimization is enabled but no campaign budget is set. Add a Daily or Lifetime Budget.',
        severity: 'error',
      });
    }

    // CBO budget floor check
    if (isCBO) {
      if (hasDailyBudget && Number(data.daily_budget) < MIN_DAILY_BUDGET_FLOOR) {
        errors.push({
          field: 'daily_budget',
          message: `Daily budget of ${(Number(data.daily_budget) / 100).toFixed(2)} may be below Meta's minimum for your currency. Increase the budget to avoid rejection.`,
          severity: 'warning',
        });
      }
      if (hasLifetimeBudget && data.stop_time) {
        const start = data.start_time ? new Date(data.start_time).getTime() : Date.now();
        const end = new Date(data.stop_time).getTime();
        const days = Math.max(1, Math.ceil((end - start) / 86_400_000));
        const dailyEquiv = Math.floor(Number(data.lifetime_budget) / days);
        if (dailyEquiv < MIN_DAILY_BUDGET_FLOOR) {
          errors.push({
            field: 'lifetime_budget',
            message: `Lifetime budget averages ~${(dailyEquiv / 100).toFixed(2)}/day over ${days} days, which may be below Meta's minimum for your currency. Increase the budget or shorten the schedule.`,
            severity: 'warning',
          });
        }
      }
    }

    // special_ad_categories: NONE must not coexist with real categories
    const cats: string[] = data.special_ad_categories || [];
    const realCats = cats.filter((c: string) => c !== 'NONE');
    if (realCats.length > 0 && cats.includes('NONE')) {
      errors.push({
        field: 'special_ad_categories',
        message: '"None" should be removed when real special ad categories are selected.',
        severity: 'warning',
      });
    }

    // start_time after stop_time
    if (data.start_time && data.stop_time) {
      const start = new Date(data.start_time).getTime();
      const stop = new Date(data.stop_time).getTime();
      if (!isNaN(start) && !isNaN(stop) && start >= stop) {
        errors.push({
          field: 'stop_time',
          message: 'Campaign end time must be after the start time.',
          severity: 'error',
        });
      }
    }

    if (campaign.metaId) {
      for (const field of IMMUTABLE_CAMPAIGN_FIELDS) {
        if (data[`_original_${field}`] !== undefined &&
            JSON.stringify(data[field]) !== JSON.stringify(data[`_original_${field}`])) {
          errors.push({
            field,
            message: `${labelField(field)} cannot be changed after publishing. The current Meta value will be kept. To change it, delete and re-publish.`,
            severity: 'warning',
          });
        }
      }
    }

    return errors;
  }

  static async validateAdSet(adSet: DraftAdSet, campaignObjective?: string, isCBO?: boolean): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    const data = adSet.data as any;

    if (!adSet.name) {
      errors.push({ field: 'name', message: 'Ad Set name is required.', severity: 'error' });
    }

    if (!data.billing_event) {
      errors.push({ field: 'billing_event', message: 'Billing event is required.', severity: 'error' });
    }

    if (!data.optimization_goal) {
      errors.push({ field: 'optimization_goal', message: 'Optimization goal is required.', severity: 'error' });
    }

    if (data.billing_event && data.optimization_goal) {
      const VALID_BILLING: Record<string, string[]> = {
        LINK_CLICKS: ['IMPRESSIONS', 'LINK_CLICKS'],
        APP_INSTALLS: ['IMPRESSIONS', 'APP_INSTALLS'],
        PAGE_LIKES: ['IMPRESSIONS', 'PAGE_LIKES'],
        POST_ENGAGEMENT: ['IMPRESSIONS', 'POST_ENGAGEMENT'],
        THRUPLAY: ['IMPRESSIONS', 'THRUPLAY'],
      };
      const allowed = VALID_BILLING[data.optimization_goal] || ['IMPRESSIONS'];
      if (!allowed.includes(data.billing_event)) {
        errors.push({
          field: 'billing_event',
          message: `Billing event "${data.billing_event}" is not valid for optimization goal "${data.optimization_goal}". Use one of: ${allowed.join(', ')}.`,
          severity: 'error',
        });
      }
    }

    if (!data.targeting) {
      errors.push({ field: 'targeting', message: 'Targeting is required. Add at least a country or region.', severity: 'error' });
    }

    if (campaignObjective && data.optimization_goal) {
      const validGoals = VALID_OPTIMIZATION_GOALS[campaignObjective];
      if (validGoals && !validGoals.includes(data.optimization_goal)) {
        errors.push({
          field: 'optimization_goal',
          message: `"${labelGoal(data.optimization_goal)}" is not available for ${labelObj(campaignObjective)} campaigns. Choose from: ${validGoals.map(g => labelGoal(g)).join(', ')}.`,
          severity: 'error',
        });
      }
    }

    if (campaignObjective && data.destination_type) {
      const validDestinations = VALID_DESTINATION_TYPES[campaignObjective];
      if (validDestinations && !validDestinations.includes(data.destination_type)) {
        errors.push({
          field: 'destination_type',
          message: `"${labelDest(data.destination_type)}" is not available for ${labelObj(campaignObjective)} campaigns. Choose from: ${validDestinations.map(d => labelDest(d)).join(', ')}.`,
          severity: 'error',
        });
      }
    }

    if (campaignObjective) {
      const requiredFields = PROMOTED_OBJECT_REQUIREMENTS[campaignObjective] || [];
      if (requiredFields.length > 0) {
        const friendlyFields = requiredFields.map((f: string) => labelPromoted(f)).join(' or ');
        if (!data.promoted_object) {
          errors.push({
            field: 'promoted_object',
            message: `${labelObj(campaignObjective)} campaigns require a ${friendlyFields} in Promoted Object.`,
            severity: 'error',
          });
        } else {
          const hasRequired = requiredFields.some((f: string) => data.promoted_object[f]);
          if (!hasRequired) {
            errors.push({
              field: 'promoted_object',
              message: `Promoted Object is missing a ${friendlyFields}, which is required for ${labelObj(campaignObjective)} campaigns.`,
              severity: 'error',
            });
          }
        }
      }
      // OUTCOME_SALES additionally requires a custom_event_type (Meta will reject otherwise)
      if (campaignObjective === 'OUTCOME_SALES' && data.promoted_object && !data.promoted_object.custom_event_type) {
        errors.push({
          field: 'promoted_object.custom_event_type',
          message: 'Sales campaigns require a Custom Event Type (e.g. PURCHASE, ADD_TO_CART) in Promoted Object.',
          severity: 'error',
        });
      }

      // APP destination_type requires promoted_object with application_id regardless of objective
      if (data.destination_type === 'APP' && campaignObjective !== 'OUTCOME_APP_PROMOTION') {
        if (!data.promoted_object?.application_id) {
          errors.push({
            field: 'promoted_object',
            message: 'App destination type requires an Application ID in Promoted Object.',
            severity: 'error',
          });
        }
      }

      // APP_PROMOTION requires object_store_url in promoted_object
      if (campaignObjective === 'OUTCOME_APP_PROMOTION' && data.promoted_object?.application_id && !data.promoted_object?.object_store_url) {
        errors.push({
          field: 'promoted_object.object_store_url',
          message: 'App Promotion campaigns require an App Store URL (object_store_url) in Promoted Object.',
          severity: 'error',
        });
      }
    }

    if (!isCBO && data.bid_strategy && BID_CAP_STRATEGIES.has(data.bid_strategy)) {
      if (!data.bid_amount) {
        errors.push({
          field: 'bid_amount',
          message: `${labelBid(data.bid_strategy)} strategy requires a bid amount. Set a bid amount or switch to Highest Volume.`,
          severity: 'error',
        });
      } else if (data.bid_amount !== undefined && Number(data.bid_amount) <= 0) {
        errors.push({
          field: 'bid_amount',
          message: 'Bid amount must be greater than 0.',
          severity: 'error',
        });
      }
    }

    // COST_CAP is incompatible with awareness-type optimization goals
    if (data.optimization_goal && data.bid_strategy === 'COST_CAP' && COST_CAP_INCOMPATIBLE_GOALS.has(data.optimization_goal)) {
      errors.push({
        field: 'optimization_goal',
        message: `"${labelGoal(data.optimization_goal)}" is not compatible with Cost Per Result Goal (Cost Cap). Choose a different optimization goal or switch to Highest Volume.`,
        severity: 'error',
      });
    }

    // Bid-cap strategies require billing_event: IMPRESSIONS
    if (data.billing_event && data.billing_event !== 'IMPRESSIONS' && BID_CAP_STRATEGIES.has(data.bid_strategy)) {
      errors.push({
        field: 'billing_event',
        message: `${labelBid(data.bid_strategy)} only supports Impressions as billing event. Change billing event to Impressions.`,
        severity: 'error',
      });
    }

    if (campaignObjective && data.attribution_spec) {
      if (!ATTRIBUTION_SPEC_OBJECTIVES.has(campaignObjective)) {
        errors.push({
          field: 'attribution_spec',
          message: `Attribution settings are not supported for ${labelObj(campaignObjective)} campaigns and will be removed by Meta.`,
          severity: 'warning',
        });
      }
    }

    if (isCBO) {
      if (data.daily_budget || data.lifetime_budget) {
        errors.push({
          field: 'budget',
          message: 'Ad set budgets are not allowed under CBO campaigns. Budget is managed at campaign level.',
          severity: 'error',
        });
      }
    } else if (isCBO === false) {
      const hasDailyBudget = data.daily_budget && Number(data.daily_budget) > 0;
      const hasLifetimeBudget = data.lifetime_budget && Number(data.lifetime_budget) > 0;
      if (!hasDailyBudget && !hasLifetimeBudget) {
        errors.push({
          field: 'budget',
          message: 'Ad set needs a Daily or Lifetime Budget when Campaign Budget Optimization is off.',
          severity: 'error',
        });
      }
      if (hasDailyBudget && hasLifetimeBudget) {
        errors.push({
          field: 'budget',
          message: 'Choose either Daily Budget or Lifetime Budget — you cannot use both on an ad set.',
          severity: 'error',
        });
      }
      if (hasDailyBudget && Number(data.daily_budget) < MIN_DAILY_BUDGET_FLOOR) {
        errors.push({
          field: 'daily_budget',
          message: `Daily budget of ${(Number(data.daily_budget) / 100).toFixed(2)} may be below Meta's minimum for your currency. Increase the budget to avoid rejection.`,
          severity: 'warning',
        });
      }
      if (hasLifetimeBudget && data.end_time) {
        const start = data.start_time ? new Date(data.start_time).getTime() : Date.now();
        const end = new Date(data.end_time).getTime();
        const days = Math.max(1, Math.ceil((end - start) / 86_400_000));
        const dailyEquiv = Math.floor(Number(data.lifetime_budget) / days);
        if (dailyEquiv < MIN_DAILY_BUDGET_FLOOR) {
          errors.push({
            field: 'lifetime_budget',
            message: `Lifetime budget averages ~${(dailyEquiv / 100).toFixed(2)}/day over ${days} days, which may be below Meta's minimum for your currency. Increase the budget or shorten the schedule.`,
            severity: 'warning',
          });
        }
      }
    }

    // ─── Targeting conflict checks (mirrors DraftPublishService.resolveTargetingConflicts) ───
    const targeting = data.targeting || {};
    const advantageAudience = targeting.targeting_automation?.advantage_audience;

    if (advantageAudience === 1) {
      if (targeting.age_min > 25) {
        errors.push({
          field: 'targeting',
          message: 'Advantage+ Audience limits minimum age to 25. Lower the age or turn off Advantage Audience.',
          severity: 'warning',
        });
      }
      if (targeting.publisher_platforms?.length > 0) {
        errors.push({
          field: 'targeting',
          message: 'Advantage+ Audience does not support manual platform selection. Remove platforms or turn off Advantage Audience.',
          severity: 'warning',
        });
      }
      const genders: string[] = targeting.genders || [];
      if (genders.length > 0 && !(genders.length === 1 && String(genders[0]) === '0')) {
        errors.push({
          field: 'targeting',
          message: 'Advantage+ Audience does not support narrow gender targeting. Remove gender filter or turn off Advantage Audience.',
          severity: 'warning',
        });
      }
    }

    const platforms: string[] = targeting.publisher_platforms || [];
    if (platforms.length > 0 && !platforms.includes('facebook')) {
      if (platforms.includes('messenger') || platforms.includes('audience_network')) {
        errors.push({
          field: 'targeting',
          message: 'Messenger and Audience Network require Facebook to also be selected as a platform.',
          severity: 'warning',
        });
      }
    }

    // Marketplace position requires Facebook News Feed (Meta error 100/1815698).
    const fbPositions: string[] = targeting.facebook_positions || [];
    if (fbPositions.includes('marketplace') && !fbPositions.includes('feed')) {
      errors.push({
        field: 'targeting.facebook_positions',
        message: 'Facebook Marketplace placement also requires Facebook News Feed. Add "feed" or remove "marketplace".',
        severity: 'error',
      });
    }

    // Search position requires Facebook News Feed (Meta error 100/2490047).
    if (fbPositions.includes('search') && !fbPositions.includes('feed')) {
      errors.push({
        field: 'targeting.facebook_positions',
        message: 'Facebook Search placement also requires Facebook News Feed. Add "feed" or remove "search".',
        severity: 'error',
      });
    }

    // Missing geo targeting
    if (data.targeting && typeof data.targeting === 'object') {
      const geo = data.targeting.geo_locations;
      const hasGeo = geo && (geo.countries?.length || geo.regions?.length || geo.cities?.length || geo.zips?.length);
      if (!hasGeo) {
        errors.push({
          field: 'targeting',
          message: 'No location targeting set. Add at least one country, region, or city.',
          severity: 'warning',
        });
      }
    }

    const geoCountries: string[] = targeting.geo_locations?.countries || [];
    if (geoCountries.includes('TH') && targeting.age_min && targeting.age_min < 20) {
      errors.push({
        field: 'targeting',
        message: 'Thailand requires minimum age of 20.',
        severity: 'error',
      });
    }

    // EU DSA compliance — dsa_beneficiary and dsa_payor required when targeting EU/EEA countries (Meta error 100/3858081)
    const EU_COUNTRIES = new Set([
      'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
      'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
      'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
      'IS', 'LI', 'NO',
    ]);
    const targetsEU = geoCountries.some(c => EU_COUNTRIES.has(c));
    if (targetsEU) {
      if (!data.dsa_beneficiary) {
        errors.push({
          field: 'dsa_beneficiary',
          message: 'DSA Beneficiary is required when targeting EU/EEA countries. Enter the person or organization being promoted.',
          severity: 'error',
        });
      }
      if (!data.dsa_payor) {
        errors.push({
          field: 'dsa_payor',
          message: 'DSA Payor is required when targeting EU/EEA countries. Enter the entity paying for the ad.',
          severity: 'error',
        });
      }
    }

    // age_min must be <= age_max
    const ageMin = targeting.age_min !== undefined ? Number(targeting.age_min) : undefined;
    const ageMax = targeting.age_max !== undefined ? Number(targeting.age_max) : undefined;
    if (ageMin !== undefined && ageMax !== undefined && !isNaN(ageMin) && !isNaN(ageMax) && ageMin > ageMax) {
      errors.push({
        field: 'targeting',
        message: `Minimum age (${ageMin}) is higher than maximum age (${ageMax}). Adjust the age range.`,
        severity: 'error',
      });
    }

    // lifetime_budget requires end_time
    if (!isCBO && data.lifetime_budget && Number(data.lifetime_budget) > 0 && !data.end_time) {
      errors.push({
        field: 'end_time',
        message: 'Lifetime Budget requires an end date. Set an end time for this ad set.',
        severity: 'error',
      });
    }

    // start_time after end_time
    if (data.start_time && data.end_time) {
      const start = new Date(data.start_time).getTime();
      const end = new Date(data.end_time).getTime();
      if (!isNaN(start) && !isNaN(end) && start >= end) {
        errors.push({
          field: 'end_time',
          message: 'Ad set end time must be after the start time.',
          severity: 'error',
        });
      }
    }

    // end_time in the past blocks publishing
    if (data.end_time) {
      const end = new Date(data.end_time).getTime();
      if (!isNaN(end) && end <= Date.now()) {
        errors.push({
          field: 'end_time',
          message: 'Ad set end time is in the past. Update the end date before publishing.',
          severity: 'error',
        });
      }
    }

    // start_time in the past — Meta will start the ad set immediately. This is
    // expected for duplicated campaigns (the original often ran months ago), so
    // surface it as informational rather than a warning. A 5-minute grace buffer
    // avoids false positives for start times that are effectively "now".
    if (data.start_time) {
      const start = new Date(data.start_time).getTime();
      if (!isNaN(start) && start < Date.now() - 300_000) {
        errors.push({
          field: 'start_time',
          message: 'Start time is in the past — Meta will begin running this ad set as soon as it\'s published.',
          severity: 'info',
        });
      }
    }

    if (adSet.metaId) {
      for (const field of IMMUTABLE_ADSET_FIELDS) {
        if (field === 'campaign_id') continue;
        if (data[`_original_${field}`] !== undefined &&
            JSON.stringify(data[field]) !== JSON.stringify(data[`_original_${field}`])) {
          errors.push({
            field,
            message: `${labelField(field)} cannot be changed after publishing. The current Meta value will be kept.`,
            severity: 'warning',
          });
        }
      }
    }

    return errors;
  }

  static async validateAd(ad: DraftAd, isDynamicCreative?: boolean, adSetContext: any = {}): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    const data = ad.data as any;
    const targeting = adSetContext.targeting || {};

    if (!ad.name) {
      errors.push({ field: 'name', message: 'Ad name is required.', severity: 'error' });
    }

    if (!data.creative) {
      errors.push({ field: 'creative', message: 'Ad creative is required. Set up a creative with an image, video, or Creative ID.', severity: 'error' });
      return errors;
    }

    const hasCreativeId = data.creative.id || data.creative.creative_id;
    const oss = data.creative.object_story_spec;
    const hasAssetFeed = data.creative.asset_feed_spec;
    const hasPlatformCustomizations = data.creative.platform_customizations;

    if (!hasCreativeId && !oss && !hasAssetFeed) {
      errors.push({ field: 'creative', message: 'Ad creative is incomplete. Add an image/video, set up a creative, or provide a Creative ID.', severity: 'error' });
      return errors;
    }

    // Dynamic Creative mismatch check.
    //
    // When an ad was duplicated from a DC campaign, its stored creative carries BOTH a
    // creative.id (existingMetaCreativeId) and an asset_feed_spec. In a non-DC ad set the
    // publish path takes the creative_id shortcut and never sends asset_feed_spec, so the
    // stored asset_feed_spec is effectively ignored and causes no publish error — flagging
    // it as an error here would be a false positive.
    //
    // Only fire when there is an asset_feed_spec but NO creative.id/creative_id, because in
    // that case publishing a non-DC ad set would actually try to use asset_feed_spec and fail.
    if (hasAssetFeed && !isDynamicCreative && !hasCreativeId) {
      errors.push({
        field: 'creative.asset_feed_spec',
        message: 'Dynamic Creative assets (Asset Feed) require "Dynamic Creative" to be enabled on the Ad Set level.',
        severity: 'error',
      });
    }

    // Identity resolution check
    const hasPageId = data.creative.page_id
      || data.page_id
      || adSetContext.page_id
      || adSetContext.promoted_object?.page_id
      || data.creative.object_story_spec?.page_id;

    // asset_feed_spec ads are pre-created as /adcreatives before publish.
    // That call requires object_story_spec.page_id — validate it's resolvable.
    if (hasAssetFeed && !hasPageId) {
      errors.push({
        field: 'creative.asset_feed_spec',
        message: 'Dynamic Creative requires a Page ID to publish. Set it on the Ad Set\'s Promoted Object or the Ad\'s Page ID field.',
        severity: 'error',
      });
    }

    // Placement-specific media requirements
    const platforms: string[] = targeting.publisher_platforms || [];
    const anPositions: string[] = targeting.audience_network_positions || [];
    const isRewarded = anPositions.includes('rewarded_video');
    const isThreads = platforms.includes('threads');

    if (isRewarded) {
      const hasVideo = oss?.video_data?.video_id || (hasAssetFeed && data.creative.asset_feed_spec.videos?.length > 0);
      if (!hasVideo && !hasCreativeId) {
        errors.push({
          field: 'creative',
          message: 'Audience Network Rewarded Video placement requires a video. Please add a video to your creative.',
          severity: 'error',
        });
      }
    }

    if (isThreads && !hasCreativeId) {
      // Threads often has specific media requirements or fails with generic specs
      errors.push({
        field: 'creative',
        message: 'Threads placement is selected. Ensure your creative meets Threads media requirements (Threads Media ID may be required by Meta).',
        severity: 'warning',
      });
    }

    // Creative ID override warning. Suppressed for Dynamic Creative ad sets: there the
    // publish path builds an INLINE asset_feed_spec creative and omits creative_id entirely
    // (see DraftPublishService.createMetaAd DC branch), so the dynamic assets are NOT ignored
    // and the warning would be misleading.
    if (hasCreativeId && (hasAssetFeed || hasPlatformCustomizations) && !isDynamicCreative) {
      errors.push({
        field: 'creative.creative_id',
        message: 'Platform customizations or dynamic assets will be ignored when using an existing Creative ID. Clear the Creative ID to use these advanced settings.',
        severity: 'warning',
      });
    }

    if (oss && !hasCreativeId) {
      const hasLinkData = oss.link_data && Object.keys(oss.link_data).length > 0;
      const hasVideoData = oss.video_data && Object.keys(oss.video_data).length > 0;
      const hasPhotoData = oss.photo_data && Object.keys(oss.photo_data).length > 0;

      if (!hasLinkData && !hasVideoData && !hasPhotoData) {
        errors.push({ field: 'creative', message: 'Creative is missing content. Choose a type (Link, Video, Photo, or Carousel) and fill in the required fields.', severity: 'error' });
      }

      if (hasVideoData && !oss.video_data.video_id) {
        errors.push({ field: 'creative.video_data.video_id', message: 'Video ad requires a Video ID. Upload a video or paste an existing Video ID.', severity: 'error' });
      }

      if (hasPhotoData && !oss.photo_data.image_hash) {
        errors.push({ field: 'creative.photo_data.image_hash', message: 'Photo ad requires an image. Upload an image or paste an existing Image Hash.', severity: 'error' });
      }

      if (hasLinkData) {
        const isCarousel = !!oss.link_data.child_attachments;

        if (!isCarousel) {
          // Single link ad: needs destination URL and a visual (image or video)
          if (!oss.link_data.link) {
            errors.push({ field: 'creative.link_data.link', message: 'Link ad requires a destination URL.', severity: 'error' });
          }
          if (!oss.link_data.image_hash && !oss.link_data.picture && !oss.link_data.video_id) {
            errors.push({ field: 'creative.link_data.image_hash', message: 'Link ad requires an image, image hash, or video. Add a visual to the creative.', severity: 'error' });
          }
        } else {
          const cards = oss.link_data.child_attachments;
          if (!Array.isArray(cards) || cards.length < 2) {
            errors.push({ field: 'creative.child_attachments', message: 'Carousel ads require at least 2 cards.', severity: 'error' });
          } else {
            cards.forEach((card: any, i: number) => {
              if (!card.link) {
                errors.push({ field: `creative.child_attachments[${i}].link`, message: `Carousel card ${i + 1} is missing a destination URL.`, severity: 'error' });
              }
              if (!card.image_hash && !card.picture && !card.video_id) {
                errors.push({ field: `creative.child_attachments[${i}].image_hash`, message: `Carousel card ${i + 1} is missing an image or video.`, severity: 'error' });
              }
            });
          }
        }
      }

      if (!oss.page_id && !hasPageId) {
        errors.push({
          field: 'creative.page_id',
          message: 'Facebook Page is required for inline creatives. Please select a Page in the ad setup.',
          severity: 'error',
        });
      }
    }

    if (hasAssetFeed) {
      const afs = data.creative.asset_feed_spec;
      if (!afs.images?.length && !afs.videos?.length) {
        errors.push({ field: 'creative.asset_feed_spec', message: 'Dynamic creative requires at least one image or video.', severity: 'error' });
      }
      if (!afs.bodies?.length) {
        errors.push({ field: 'creative.asset_feed_spec.bodies', message: 'Advanced creative requires at least one body text.', severity: 'error' });
      }
      if (!afs.titles?.length) {
        errors.push({ field: 'creative.asset_feed_spec.titles', message: 'Advanced creative requires at least one title.', severity: 'error' });
      }
      if (!afs.link_urls?.length) {
        errors.push({ field: 'creative.asset_feed_spec.link_urls', message: 'Advanced creative requires at least one website URL.', severity: 'error' });
      } else {
        afs.link_urls.forEach((l: any, i: number) => {
          if (!l.website_url) {
            errors.push({ field: `creative.asset_feed_spec.link_urls[${i}]`, message: `Website URL ${i + 1} is missing a destination.`, severity: 'error' });
          }
        });
      }
      if (afs.call_to_action_types?.length > 5) {
        errors.push({
          field: 'creative.asset_feed_spec.call_to_action_types',
          message: `${afs.call_to_action_types.length} call-to-action types detected — Meta allows 5 max. Only the first 5 will be used when publishing (no action needed — this is handled automatically).`,
          severity: 'warning',
        });
      }
      if (afs.images?.length > 10) {
        errors.push({
          field: 'creative.asset_feed_spec.images',
          message: `${afs.images.length} images detected — Meta allows 10 max. Only the first 10 will be used when publishing.`,
          severity: 'warning',
        });
      }
      if (afs.bodies?.length > 5) {
        errors.push({
          field: 'creative.asset_feed_spec.bodies',
          message: `${afs.bodies.length} body texts detected — Meta allows 5 max. Only the first 5 will be used when publishing.`,
          severity: 'warning',
        });
      }
      if (afs.titles?.length > 5) {
        errors.push({
          field: 'creative.asset_feed_spec.titles',
          message: `${afs.titles.length} titles detected — Meta allows 5 max. Only the first 5 will be used when publishing.`,
          severity: 'warning',
        });
      }
      if (afs.ad_formats?.length > 1) {
        errors.push({
          field: 'creative.asset_feed_spec.ad_formats',
          message: `Multiple ad formats detected (${afs.ad_formats.join(', ')}) — Meta allows exactly one. Only "${afs.ad_formats[0]}" will be used when publishing.`,
          severity: 'warning',
        });
      }
      if (!afs.ad_formats && afs.images?.length && afs.videos?.length) {
        const keepImages = afs.images.length >= afs.videos.length;
        errors.push({
          field: 'creative.asset_feed_spec',
          message: `Both image and video assets found — Meta requires a single format. The ${keepImages ? 'image' : 'video'} assets will be used when publishing. To control which format is used, set the Ad Format field in the creative to either Single Image or Single Video.`,
          severity: 'warning',
        });
      }

      if (!hasPageId) {
        errors.push({
          field: 'creative.page_id',
          message: 'Facebook Page is required for dynamic creative. Please select a Page in the ad setup.',
          severity: 'error',
        });
      }
    }

    return errors;
  }

  static async validateFullDraft(campaign: any): Promise<{
    campaignErrors: ValidationError[];
    adSetErrors: Record<string, ValidationError[]>;
    adErrors: Record<string, ValidationError[]>;
    isValid: boolean;
  }> {
    const campaignErrors = await this.validateCampaign(campaign);
    const adSetErrors: Record<string, ValidationError[]> = {};
    const adErrors: Record<string, ValidationError[]> = {};

    let isValid = campaignErrors.every(e => e.severity !== 'error');

    if (campaign.adSets) {
      const campaignData = campaign.data as any;
      const campaignObjective = campaignData?.objective || campaign.objective;
      const isCBO = !!(campaignData.daily_budget || campaignData.lifetime_budget);

      if (campaign.adSets.length === 0) {
        campaignErrors.push({
          field: 'adSets',
          message: 'Campaign has no ad sets. Add at least one ad set before publishing.',
          severity: 'error',
        });
        isValid = false;
      }

      // CBO-level COST_CAP cross-validation with ad set optimization goals
      if (isCBO && campaignData.bid_strategy === 'COST_CAP') {
        for (const adSet of campaign.adSets) {
          const adSetGoal = (adSet.data as any)?.optimization_goal;
          if (adSetGoal && COST_CAP_INCOMPATIBLE_GOALS.has(adSetGoal)) {
            if (!adSetErrors[adSet.id]) adSetErrors[adSet.id] = [];
            adSetErrors[adSet.id].push({
              field: 'optimization_goal',
              message: `"${labelGoal(adSetGoal)}" is not compatible with the campaign's Cost Per Result Goal (Cost Cap) bid strategy. Change the optimization goal or switch the campaign to Highest Volume.`,
              severity: 'error',
            });
            isValid = false;
          }
        }
      }

      // Cross-validate: special_ad_category_country must cover ad set targeting countries.
      // If sacCountries is empty, publish auto-derives them from ad set geos — that's fine.
      // Only warn when sacCountries is set but missing some of the ad set's countries,
      // because auto-derive only kicks in when the field is entirely empty.
      const cats: string[] = campaignData.special_ad_categories || [];
      const realCats = cats.filter((c: string) => c !== 'NONE');
      if (realCats.length > 0) {
        const sacCountries: string[] = campaignData.special_ad_category_country || [];
        if (sacCountries.length > 0) {
          for (const adSet of campaign.adSets) {
            const adSetTargeting = (adSet.data as any)?.targeting;
            const adSetCountries: string[] = adSetTargeting?.geo_locations?.countries || [];
            const missing = adSetCountries.filter((c: string) => !sacCountries.includes(c));
            if (missing.length > 0) {
              campaignErrors.push({
                field: 'special_ad_category_country',
                message: `Ad set "${adSet.name}" targets ${missing.join(', ')} but those countries are not in Special Ad Category countries (${sacCountries.join(', ')}). Add them or remove from ad set targeting.`,
                severity: 'error',
              });
              isValid = false;
              break;
            }
          }
        }

        // Special Ad Categories force age 18–65 (Meta error 2909037: "Custom age
        // selection is unavailable…"). Any custom age range is rejected.
        for (const adSet of campaign.adSets) {
          const t = (adSet.data as any)?.targeting;
          if (!t) continue;
          const ageMin = t.age_min !== undefined ? Number(t.age_min) : 18;
          const ageMax = t.age_max !== undefined ? Number(t.age_max) : 65;
          if (ageMin !== 18 || ageMax < 65) {
            if (!adSetErrors[adSet.id]) adSetErrors[adSet.id] = [];
            adSetErrors[adSet.id].push({
              field: 'special_ad_categories',
              message: `Custom age range (${ageMin}–${ageMax}) not allowed with Special Ad Categories. Reset to 18–65+ or remove Special Ad Categories from the campaign.`,
              severity: 'error',
            });
            isValid = false;
          }
        }

        // Hard conflict: Special Ad Categories force age 18, but Thailand
        // targeting forces age_min ≥ 20. The two cannot coexist — the user must
        // drop one. Highlight this explicitly so they don't ping-pong between
        // "TH requires 20" and "Special categories require 18".
        for (const adSet of campaign.adSets) {
          const t = (adSet.data as any)?.targeting;
          const countries: string[] = t?.geo_locations?.countries || [];
          if (countries.includes('TH')) {
            if (!adSetErrors[adSet.id]) adSetErrors[adSet.id] = [];
            adSetErrors[adSet.id].push({
              field: 'special_ad_categories',
              message: `Targets Thailand (requires age 20+), but Special Ad Categories require ages 18–65+. These cannot coexist. Either remove Thailand from targeting or remove Special Ad Categories from the campaign.`,
              severity: 'error',
            });
            isValid = false;
          }
        }
      }

      for (const adSet of campaign.adSets) {
        const errors = await this.validateAdSet(adSet, campaignObjective, isCBO);
        adSetErrors[adSet.id] = [...(adSetErrors[adSet.id] || []), ...errors];
        if (errors.some(e => e.severity === 'error')) isValid = false;

        if (adSet.ads) {
          if (adSet.ads.length === 0) {
            adSetErrors[adSet.id].push({
              field: 'ads',
              message: `Ad set "${adSet.name}" has no ads. Add at least one ad before publishing.`,
              severity: 'error',
            });
            isValid = false;
          }

          const adSetData = adSet.data as any;
          const adSetDestType = adSet.metaId && adSetData._original_destination_type !== undefined
            ? adSetData._original_destination_type
            : adSetData?.destination_type;
          const messengerDest = ['MESSENGER', 'WHATSAPP', 'INSTAGRAM_DIRECT'].includes(adSetDestType);
          const isDynamicAdSet = !!(adSet.data as any)?.is_dynamic_creative;
          for (const ad of adSet.ads) {
            const adValidationErrors = await this.validateAd(ad, isDynamicAdSet, adSetData);
            if (messengerDest) {
              const adData = ad.data as any;
              const creative = adData?.creative;
              const hasCreativeId = !!(creative?.creative_id || creative?.id);
              if (hasCreativeId) {
                adValidationErrors.push({
                  field: 'creative',
                  message: `Ad set destination is "${adSetDestType}" but this ad uses a creative_id reference. ${adSetDestType} ads require a compatible object_story_spec creative. Change the destination type or update the creative.`,
                  severity: 'error',
                });
              }
            }
            adErrors[ad.id] = adValidationErrors;
            if (adValidationErrors.some(e => e.severity === 'error')) isValid = false;
          }
        }
      }
    }

    return { campaignErrors, adSetErrors, adErrors, isValid };
  }
}
