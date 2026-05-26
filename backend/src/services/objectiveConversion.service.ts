import { FacebookService } from './facebook.service';
import { VALID_BUYING_TYPES, sanitizeTargeting, ATTRIBUTION_SPEC_OBJECTIVES } from './draft/MetaFieldRegistry';

function redactPayload(payload: any): any {
  const { targeting, ...rest } = payload;
  return targeting ? { ...rest, targeting: '[redacted]' } : rest;
}

export interface ConversionMapping {
  objective: string;
  optimization_goal: string;
  billing_event: string;
}

export const OBJECTIVE_DEFAULTS: Record<string, ConversionMapping> = {
  'OUTCOME_AWARENESS': {
    objective: 'OUTCOME_AWARENESS',
    optimization_goal: 'REACH',
    billing_event: 'IMPRESSIONS'
  },
  'OUTCOME_TRAFFIC': {
    objective: 'OUTCOME_TRAFFIC',
    optimization_goal: 'LINK_CLICKS',
    billing_event: 'IMPRESSIONS'
  },
  'OUTCOME_ENGAGEMENT': {
    objective: 'OUTCOME_ENGAGEMENT',
    optimization_goal: 'POST_ENGAGEMENT',
    billing_event: 'IMPRESSIONS'
  },
  'OUTCOME_LEADS': {
    objective: 'OUTCOME_LEADS',
    optimization_goal: 'LEAD_GENERATION',
    billing_event: 'IMPRESSIONS'
  },
  'OUTCOME_SALES': {
    objective: 'OUTCOME_SALES',
    optimization_goal: 'OFFSITE_CONVERSIONS',
    billing_event: 'IMPRESSIONS'
  },
  'OUTCOME_APP_PROMOTION': {
    objective: 'OUTCOME_APP_PROMOTION',
    optimization_goal: 'APP_INSTALLS',
    billing_event: 'IMPRESSIONS'
  }
};

export const LEGACY_OBJECTIVE_MAP: Record<string, string> = {
  'REACH': 'OUTCOME_AWARENESS',
  'BRAND_AWARENESS': 'OUTCOME_AWARENESS',
  'LINK_CLICKS': 'OUTCOME_TRAFFIC',
  'POST_ENGAGEMENT': 'OUTCOME_ENGAGEMENT',
  'CONVERSIONS': 'OUTCOME_SALES',
  'PRODUCT_CATALOG_SALES': 'OUTCOME_SALES',
  'LEAD_GENERATION': 'OUTCOME_LEADS',
  'APP_INSTALLS': 'OUTCOME_APP_PROMOTION'
};

export class ObjectiveConversionService {
  private fbService: FacebookService;

  constructor(fbService: FacebookService) {
    this.fbService = fbService;
  }

  async getPreview(type: 'CAMPAIGN' | 'ADSET' | 'AD', id: string, targetObjective: string, newName?: string) {
    if (type === 'CAMPAIGN') return this.previewCampaign(id, targetObjective, newName);
    if (type === 'ADSET') return this.previewAdSet(id, targetObjective, newName);
    if (type === 'AD') return this.previewAd(id, targetObjective, newName);
    throw new Error('Invalid type for preview');
  }

  private async previewCampaign(campaignId: string, targetObjective: string, newName?: string) {
    const original = await this.fbService.get(`/${campaignId}`, {
      fields: 'name,objective,bid_strategy,buying_type,daily_budget,lifetime_budget,special_ad_categories'
    });

    const campaignData = original.data;
    const transformed = this.transformCampaign(
      campaignData,
      targetObjective,
      newName || `${campaignData.name || 'Campaign'} - Converted`
    );

    const adSets = await this.fbService.getAdSets(campaignId);
    let totalAdsCount = 0;

    for (const adSet of adSets) {
      try {
        const ads = await this.fbService.getAds(adSet.id);
        totalAdsCount += ads.length;
      } catch (e) {
        console.warn(`[ObjectiveConversionService] Could not fetch ads for ad set ${adSet.id}`);
      }
    }

    const childSummary: any = {
      adSetsCount: adSets.length,
      adsCount: totalAdsCount,
      sampleAdSet: null,
      sampleAd: null
    };

    if (adSets.length > 0) {
      try {
        const fullAdSetResponse = await this.fbService.get(`/${adSets[0].id}`, {
          fields: 'name,billing_event,optimization_goal,bid_amount,daily_budget,lifetime_budget,targeting,promoted_object,attribution_spec,destination_type'
        });
        const adSetData = fullAdSetResponse.data;
        childSummary.sampleAdSet = this.transformAdSet(
          adSetData,
          targetObjective,
          `${adSetData.name || 'Ad Set'} - Converted`,
          'NEW_CAMPAIGN_ID'
        );

        const sampleAds = await this.fbService.getAds(adSets[0].id);
        if (sampleAds.length > 0) {
          const fullAdResponse = await this.fbService.get(`/${sampleAds[0].id}`, {
            fields: 'name,creative,tracking_specs'
          });
          childSummary.sampleAd = this.transformAd(
            fullAdResponse.data,
            targetObjective,
            `${fullAdResponse.data.name || 'Ad'} - Converted`,
            'NEW_ADSET_ID'
          );
        }
      } catch (e) {
        console.warn(`[ObjectiveConversionService] Error generating sample child data for preview`, e);
      }
    }

    return {
      original: campaignData,
      transformed,
      diff: this.generateDiff(campaignData, transformed),
      childSummary
    };
  }

  private async previewAdSet(adSetId: string, targetObjective: string, newName?: string) {
    const original = await this.fbService.get(`/${adSetId}`, {
      fields: 'name,billing_event,optimization_goal,bid_amount,daily_budget,lifetime_budget,targeting,promoted_object,attribution_spec,destination_type'
    });
    const transformed = this.transformAdSet(
      original.data,
      targetObjective,
      newName || `${original.data.name || 'Ad Set'} - Converted`,
      'DUMMY_CAMPAIGN_ID'
    );
    return { original: original.data, transformed, diff: this.generateDiff(original.data, transformed) };
  }

  private async previewAd(adId: string, targetObjective: string, newName?: string) {
    const original = await this.fbService.get(`/${adId}`, { fields: 'name,creative,tracking_specs' });
    const transformed = this.transformAd(
      original.data,
      targetObjective,
      newName || `${original.data.name || 'Ad'} - Converted`,
      'DUMMY_ADSET_ID'
    );
    return { original: original.data, transformed, diff: this.generateDiff(original.data, transformed) };
  }

  public transformCampaign(data: any, targetObjective: string, newName: string) {
    const isCBO = !!(
      data.bid_strategy ||
      (data.daily_budget && data.daily_budget !== '0' && data.daily_budget !== 0) ||
      (data.lifetime_budget && data.lifetime_budget !== '0' && data.lifetime_budget !== 0)
    );

    const payload: any = {
      name: String(newName),
      objective: String(targetObjective),
      status: 'PAUSED',
      special_ad_categories: data.special_ad_categories || [],
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP'
    };

    if (data.buying_type) {
      const validTypes = VALID_BUYING_TYPES[targetObjective] || ['AUCTION'];
      payload.buying_type = validTypes.includes(data.buying_type) ? data.buying_type : 'AUCTION';
    }

    if (isCBO) {
      if (data.daily_budget) payload.daily_budget = String(data.daily_budget);
      if (data.lifetime_budget) payload.lifetime_budget = String(data.lifetime_budget);
    }

    return this.cleanPayload(payload);
  }

  public transformAdSet(data: any, targetObjective: string, newName: string, campaignId: string, pageId?: string) {
    const defaults = OBJECTIVE_DEFAULTS[targetObjective] || OBJECTIVE_DEFAULTS['OUTCOME_AWARENESS'];

    let optimization_goal = defaults.optimization_goal;
    if (
      targetObjective === 'OUTCOME_ENGAGEMENT' &&
      ['POST_ENGAGEMENT', 'VIDEO_VIEWS', 'THRUPLAY', 'MESSAGES'].includes(data.optimization_goal)
    ) {
      optimization_goal = data.optimization_goal;
    } else if (
      targetObjective === 'OUTCOME_TRAFFIC' &&
      ['LINK_CLICKS', 'LANDING_PAGE_VIEWS'].includes(data.optimization_goal)
    ) {
      optimization_goal = data.optimization_goal;
    }

    const payload: any = {
      name: String(newName),
      campaign_id: String(campaignId),
      status: 'PAUSED',
      billing_event: String(defaults.billing_event),
      optimization_goal: String(optimization_goal),
      targeting: sanitizeTargeting(data.targeting)
    };

    // Destination type
    // For OUTCOME_LEADS: use WEBSITE instead of ON_AD to avoid needing a lead form ID
    // ON_AD (Instant Forms) requires an existing leadgen_form_id which we can't create on the fly
    if (targetObjective === 'OUTCOME_AWARENESS') {
      // AWARENESS only supports UNDEFINED (Default) — do not send destination_type
    } else if (targetObjective === 'OUTCOME_LEADS') {
      payload.destination_type = 'WEBSITE';
    } else if (targetObjective === 'OUTCOME_TRAFFIC') {
      payload.destination_type = 'WEBSITE';
    } else if (targetObjective === 'OUTCOME_ENGAGEMENT') {
      if (optimization_goal === 'POST_ENGAGEMENT') {
        payload.destination_type = 'ON_POST';
      } else if (optimization_goal === 'VIDEO_VIEWS' || optimization_goal === 'THRUPLAY') {
        payload.destination_type = 'ON_VIDEO';
      } else if (optimization_goal === 'MESSAGES') {
        payload.destination_type = 'FACEBOOK';
      } else {
        payload.destination_type = 'WEBSITE';
      }
    } else if (targetObjective === 'OUTCOME_SALES') {
      payload.destination_type = 'WEBSITE';
    } else if (targetObjective === 'OUTCOME_APP_PROMOTION') {
      payload.destination_type = 'APP';
    } else if (data.destination_type && data.destination_type !== 'UNDEFINED') {
      payload.destination_type = String(data.destination_type);
    }

    // Budgets
    if (data.daily_budget) payload.daily_budget = String(data.daily_budget);
    if (data.lifetime_budget) {
      payload.lifetime_budget = String(data.lifetime_budget);
      if (data.start_time) payload.start_time = data.start_time;
      if (data.end_time) payload.end_time = data.end_time;
    }

    // promoted_object
    if (
      targetObjective === 'OUTCOME_SALES' ||
      targetObjective === 'OUTCOME_LEADS' ||
      targetObjective === 'OUTCOME_APP_PROMOTION'
    ) {
      if (data.promoted_object) {
        payload.promoted_object = this.sanitizePromotedObject(data.promoted_object);
      }
      // For LEADS with WEBSITE destination: only page_id needed, no leadgen_form_id required
      if (targetObjective === 'OUTCOME_LEADS') {
        if (pageId) {
          payload.promoted_object = { page_id: String(pageId) };
        } else if (!payload.promoted_object?.page_id) {
          delete payload.promoted_object;
        }
      }
      // APP_PROMOTION needs application_id + object_store_url — source page_id is invalid
      if (targetObjective === 'OUTCOME_APP_PROMOTION') {
        const appId = data.promoted_object?.application_id;
        if (appId) {
          payload.promoted_object = {
            application_id: String(appId),
            object_store_url: data.promoted_object?.object_store_url || undefined,
          };
        } else {
          delete payload.promoted_object;
        }
      }
    } else if (targetObjective === 'OUTCOME_ENGAGEMENT') {
      const engagementPageId = data.promoted_object?.page_id || pageId;
      if (engagementPageId) payload.promoted_object = { page_id: String(engagementPageId) };
    }

    // attribution_spec only valid for SALES/LEADS/APP_PROMOTION — use canonical registry constant
    if (data.attribution_spec && ATTRIBUTION_SPEC_OBJECTIVES.has(targetObjective) && payload.destination_type !== 'ON_AD') {
      payload.attribution_spec = data.attribution_spec;
    }

    return this.cleanPayload(payload);
  }

  public transformAd(data: any, targetObjective: string, newName: string, adSetId: string) {
    const payload: any = {
      name: String(newName),
      adset_id: String(adSetId),
      status: 'PAUSED',
      creative: data?.creative?.id
        ? { creative_id: String(data.creative.id) }
        : data?.creative?.creative_id
        ? { creative_id: String(data.creative.creative_id) }
        : null
    };

    if (!payload.creative) {
      console.warn(`[ObjectiveConversionService] No valid creative found for ad, skipping creative field`);
      delete payload.creative;
    }

    if (data?.tracking_specs) payload.tracking_specs = data.tracking_specs;

    return this.cleanPayload(payload);
  }

  private cleanPayload(payload: any): any {
    const clean: any = {};
    for (const key of Object.keys(payload)) {
      if (key && key.trim() && payload[key] !== undefined && payload[key] !== null) {
        clean[key] = payload[key];
      }
    }
    return JSON.parse(JSON.stringify(clean));
  }

  private sanitizePromotedObject(promotedObject: any) {
    if (!promotedObject) return undefined;
    const { id, smart_pse_enabled, ...sanitized } = promotedObject;
    if (Object.keys(sanitized).length === 0) return undefined;
    return sanitized;
  }

  private generateDiff(original: any, transformed: any) {
    const diff: any = {};
    const allKeys = new Set([...Object.keys(original), ...Object.keys(transformed)]);
    for (const key of allKeys) {
      if (JSON.stringify(original[key]) !== JSON.stringify(transformed[key])) {
        diff[key] = { from: original[key], to: transformed[key] };
      }
    }
    return diff;
  }

  async convertCampaignDeep(
    campaignId: string,
    targetObjective: string,
    newName: string,
    adAccountId: string
  ) {
    console.log(`[ObjectiveConversionService] !!! STARTING DEEP CONVERSION !!!`);
    const normalizedAccountId = adAccountId.startsWith('act_')
      ? adAccountId
      : `act_${adAccountId}`;

    // 1. Fetch original campaign
    const originalCampaign = await this.fbService.get(`/${campaignId}`, {
      fields: 'name,objective,bid_strategy,buying_type,daily_budget,lifetime_budget,special_ad_categories'
    });
    console.log(`[ObjectiveConversionService] Original Campaign Data:`, originalCampaign.data);

    // 2. Create new campaign
    const campaignPayload = this.transformCampaign(originalCampaign.data, targetObjective, newName);
    const isNewCampaignCBO = !!(campaignPayload.daily_budget || campaignPayload.lifetime_budget);

    // Meta requires this field explicitly on non-CBO campaigns
    if (!isNewCampaignCBO) {
      campaignPayload.is_adset_budget_sharing_enabled = false;
    }

    console.log(`[ObjectiveConversionService] Creating campaign:`, JSON.stringify(redactPayload(campaignPayload)));
    const newCampaign = (
      await this.fbService.client.post(`/${normalizedAccountId}/campaigns`, campaignPayload)
    ).data;
    console.log(`[ObjectiveConversionService] SUCCESS: Campaign ID: ${newCampaign.id}`);

    // 3. Fetch ad sets from source campaign
    const adSets = await this.fbService.getAdSets(campaignId);
    console.log(`[ObjectiveConversionService] Found ${adSets?.length || 0} ad sets`);

    for (let i = 0; i < adSets.length; i++) {
      const adSet = adSets[i];
      try {
        console.log(`[ObjectiveConversionService] --- Ad Set ${i + 1}/${adSets.length}: ${adSet.id} ---`);

        // 4. Fetch full ad set data
        const fullAdSet = await this.fbService.get(`/${adSet.id}`, {
          fields: 'name,billing_event,optimization_goal,bid_amount,daily_budget,lifetime_budget,start_time,end_time,targeting,promoted_object,attribution_spec,destination_type,bid_strategy'
        });
        const adSetData = fullAdSet.data;

        // 5. Find page_id
        let inheritedPageId: string | undefined = adSetData.promoted_object?.page_id;

        if (!inheritedPageId) {
          console.log(`[ObjectiveConversionService] No page_id in ad set, searching in ads...`);
          try {
            const originalAds = await this.fbService.getAds(adSet.id);
            if (originalAds.length > 0) {
              const adResponse = await this.fbService.get(`/${originalAds[0].id}`, { fields: 'creative' });
              const creativeId = adResponse.data.creative?.id;
              if (creativeId) {
                const creativeResponse = await this.fbService.get(`/${creativeId}`, {
                  fields: 'object_id,actor_id,object_story_spec'
                });
                const cr = creativeResponse.data;
                inheritedPageId = cr.object_id || cr.actor_id || cr.object_story_spec?.page_id;
                if (inheritedPageId) {
                  console.log(`[ObjectiveConversionService] Found page_id from creative: ${inheritedPageId}`);
                } else {
                  console.warn(`[ObjectiveConversionService] Could not extract page_id from creative`);
                }
              }
            }
          } catch (e) {
            console.warn(`[ObjectiveConversionService] Failed to discover page_id from ads:`, e);
          }
        }

        // 6. Build ad set payload
        const adSetPayload = this.transformAdSet(
          adSetData,
          targetObjective,
          `${adSetData.name || 'Ad Set'} - Converted`,
          newCampaign.id,
          inheritedPageId
        );

        if (isNewCampaignCBO) {
          delete adSetPayload.daily_budget;
          delete adSetPayload.lifetime_budget;
          delete adSetPayload.start_time;
          delete adSetPayload.end_time;
          console.log(`[ObjectiveConversionService] Removed budget fields (CBO campaign)`);
        }

        console.log(`[ObjectiveConversionService] Creating ad set:`, JSON.stringify(redactPayload(adSetPayload)));
        const newAdSet = (
          await this.fbService.client.post(`/${normalizedAccountId}/adsets`, adSetPayload)
        ).data;
        console.log(`[ObjectiveConversionService] SUCCESS: Ad Set ID: ${newAdSet.id}`);

        // 7. Fetch and recreate ads
        const ads = await this.fbService.getAds(adSet.id);
        console.log(`[ObjectiveConversionService] Found ${ads.length} ads in ad set`);

        for (let j = 0; j < ads.length; j++) {
          const ad = ads[j];
          try {
            console.log(`[ObjectiveConversionService] --- Ad ${j + 1}/${ads.length}: ${ad.id} ---`);
            const fullAd = await this.fbService.get(`/${ad.id}`, {
              fields: 'name,creative,tracking_specs'
            });
            const adPayload = this.transformAd(
              fullAd.data,
              targetObjective,
              `${fullAd.data.name || 'Ad'} - Converted`,
              newAdSet.id
            );
            console.log(`[ObjectiveConversionService] Creating ad:`, JSON.stringify(adPayload)); // ads don't contain targeting
            const newAd = (
              await this.fbService.client.post(`/${normalizedAccountId}/ads`, adPayload)
            ).data;
            console.log(`[ObjectiveConversionService] SUCCESS: Ad ID: ${newAd.id}`);
          } catch (adError: any) {
            const e = adError.response?.data?.error;
            console.error(`[ObjectiveConversionService] Ad ${ad.id} FAILED:`, {
              message: e?.message,
              code: e?.code,
              error_subcode: e?.error_subcode,
              fbtrace_id: e?.fbtrace_id
            });
          }
        }
      } catch (adSetError: any) {
        const e = adSetError.response?.data?.error;
        console.error(`[ObjectiveConversionService] Ad Set ${adSet.id} FAILED:`, {
          message: e?.message,
          code: e?.code,
          error_subcode: e?.error_subcode,
          fbtrace_id: e?.fbtrace_id
        });
      }
    }

    console.log(`[ObjectiveConversionService] !!! DEEP CONVERSION FINISHED !!!`);
    return newCampaign;
  }
}