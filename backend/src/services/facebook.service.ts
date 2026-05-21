import axios from 'axios';
import FormData from 'form-data';
import { READ_ONLY_FIELDS } from './draft/MetaFieldRegistry';
import { sleep } from '../utils/sleep';

const FB_API_VERSION = 'v21.0';
const FB_BASE_URL = `https://graph.facebook.com/${FB_API_VERSION}`;

export class FacebookService {
  private accessToken: string;
  public readonly client: ReturnType<typeof axios.create>;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
    this.client = axios.create({
      baseURL: FB_BASE_URL,
      params: {
        access_token: this.accessToken,
      },
    });
  }

  private async withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
    const BURST_DELAYS = [5000, 15000, 30000];
    for (let attempt = 0; attempt <= BURST_DELAYS.length; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        const errData = error.response?.data?.error;
        const isRateLimit = errData?.code === 17 || errData?.code === 4;
        if (isRateLimit) {
          if (errData?.is_transient === false) {
            // Hourly quota exceeded — no point retrying
            throw new Error(
              `Meta API hourly rate limit exceeded for this ad account. ` +
              `Please wait before retrying. (${errData?.error_user_msg || errData?.message || ''})`
            );
          }
          if (attempt < BURST_DELAYS.length) {
            const delay = BURST_DELAYS[attempt];
            console.warn(`[FacebookService] Rate limited on ${label}, retrying in ${delay / 1000}s (attempt ${attempt + 1}/${BURST_DELAYS.length})...`);
            await sleep(delay);
            continue;
          }
        }
        throw error;
      }
    }
    throw new Error(`[FacebookService] Max retries exceeded for ${label}`);
  }

  async get(path: string, params: any = {}) {
    return this.client.get(path, { params });
  }

  async delete(id: string) {
    return this.client.delete(`/${id}`);
  }

  async getAdAccounts() {
    const response = await this.client.get('/me/adaccounts', {
      params: {
        fields: 'name,account_id,id,currency,timezone_name',
      },
    });
    return response.data.data;
  }

  async checkExistence(id: string) {
    try {
      await this.client.get(`/${id}`, { params: { fields: 'id' } });
      return true;
    } catch (error: any) {
      if (error.response?.status === 400 || error.response?.status === 404) {
        return false;
      }
      throw error;
    }
  }

  async getPixelId(adAccountId: string): Promise<string | null> {
    // Try ad account level first
    try {
      const response = await this.client.get(`/${adAccountId}/adspixels`, {
        params: { fields: 'id,name', limit: 5 }
      });
      const pixelId = response.data.data?.[0]?.id || null;
      if (pixelId) return pixelId;
    } catch (error: any) {
      console.warn(`[FacebookService] Failed to fetch pixels from ad account:`, error.response?.data?.error?.message || error.message);
    }

    // Fallback: try business level
    try {
      const accountInfo = await this.client.get(`/${adAccountId}`, {
        params: { fields: 'business' }
      });
      const businessId = accountInfo.data.business?.id;
      if (businessId) {
        const bizPixels = await this.client.get(`/${businessId}/adspixels`, {
          params: { fields: 'id,name', limit: 5 }
        });
        const pixelId = bizPixels.data.data?.[0]?.id || null;
        if (pixelId) {
          console.log(`[FacebookService] Found pixel_id ${pixelId} from business ${businessId}`);
          return pixelId;
        }
      }
    } catch (error: any) {
      console.warn(`[FacebookService] Failed to fetch pixels from business:`, error.response?.data?.error?.message || error.message);
    }

    console.warn(`[FacebookService] No pixels found for ${adAccountId} (ad account or business level)`);
    return null;
  }

  async getCampaigns(adAccountId: string) {
    const response = await this.client.get(`/${adAccountId}/campaigns`, {
      params: {
        fields: 'name,id,status,objective,bid_strategy,daily_budget,lifetime_budget,start_time,stop_time,created_time,buying_type,special_ad_categories',
      },
    });
    return response.data.data;
  }

  async getAdSets(campaignId: string) {
    const MAX_PAGES = 50;
    let allAdSets: any[] = [];
    let nextUrl: string | null = null;
    let isFirstPage = true;

    for (let page = 0; page < MAX_PAGES; page++) {
      const pageData = await this.withRetry(async () => {
        if (isFirstPage) {
          const resp = await this.client.get(`/${campaignId}/adsets`, {
            params: {
              fields: 'name,id,status,billing_event,optimization_goal,bid_amount,daily_budget,lifetime_budget,start_time,end_time,targeting,promoted_object,attribution_spec,optimization_sub_event,destination_type,bid_strategy',
              limit: 100,
            },
          });
          return resp.data;
        }
        const resp = await axios.get(nextUrl!);
        return resp.data;
      }, `getAdSets(${campaignId})`);

      isFirstPage = false;
      if (pageData.data) allAdSets = [...allAdSets, ...pageData.data];
      nextUrl = pageData.paging?.next || null;
      if (!nextUrl) break;
      if (page === MAX_PAGES - 1) {
        console.warn(`[FacebookService] getAdSets(${campaignId}) hit MAX_PAGES=${MAX_PAGES}, truncating`);
        break;
      }
      await sleep(300);
    }
    return allAdSets;
  }

  async getAds(adSetId: string) {
    const MAX_PAGES = 50;
    let allAds: any[] = [];
    let nextUrl: string | null = null;
    let isFirstPage = true;

    for (let page = 0; page < MAX_PAGES; page++) {
      const pageData = await this.withRetry(async () => {
        if (isFirstPage) {
          const resp = await this.client.get(`/${adSetId}/ads`, {
            params: {
              fields: 'name,id,status,creative{id,name,object_story_spec,asset_feed_spec,platform_customizations},tracking_specs',
              limit: 100,
            },
          });
          return resp.data;
        }
        const resp = await axios.get(nextUrl!);
        return resp.data;
      }, `getAds(${adSetId})`);

      isFirstPage = false;
      if (pageData.data) allAds = [...allAds, ...pageData.data];
      nextUrl = pageData.paging?.next || null;
      if (!nextUrl) break;
      if (page === MAX_PAGES - 1) {
        console.warn(`[FacebookService] getAds(${adSetId}) hit MAX_PAGES=${MAX_PAGES}, truncating`);
        break;
      }
      await sleep(300);
    }
    return allAds;
  }

  async duplicateCampaign(campaignId: string, newName: string, adAccountId: string, customBudget?: string) {
    console.log(`[FacebookService] Duplicating Campaign: ${campaignId}`);
    const original = await this.withRetry(
      () => this.client.get(`/${campaignId}`, {
        params: { fields: 'objective,bid_strategy,buying_type,special_ad_categories,daily_budget,lifetime_budget' },
      }),
      `duplicateCampaign:read(${campaignId})`
    );

    const data = original.data;
    let payload: any = {
      name: newName,
      objective: data.objective,
      status: 'PAUSED',
      special_ad_categories: data.special_ad_categories || [],
      is_adset_budget_sharing_enabled: false
    };

    if (data.buying_type) payload.buying_type = data.buying_type;

    const isCBO = !!(data.bid_strategy || data.daily_budget || data.lifetime_budget);

    if (customBudget && isCBO) {
      payload.daily_budget = customBudget;
      if (data.bid_strategy) payload.bid_strategy = data.bid_strategy;
    } else if (data.bid_strategy) {
      payload.bid_strategy = data.bid_strategy;
      if (data.daily_budget) payload.daily_budget = data.daily_budget;
      if (data.lifetime_budget) payload.lifetime_budget = data.lifetime_budget;
      if (!payload.daily_budget && !payload.lifetime_budget) payload.daily_budget = "100";
    } else {
      if (data.daily_budget) payload.daily_budget = data.daily_budget;
      if (data.lifetime_budget) payload.lifetime_budget = data.lifetime_budget;
    }

    const response = await this.withRetry(
      () => this.client.post(`/${adAccountId}/campaigns`, payload),
      `duplicateCampaign:create`
    );
    return response.data;
  }

  async duplicateAdSet(adSetId: string, newName: string, campaignId: string, adAccountId: string, customBudget?: string, parentCampaignIsCBO?: boolean) {
    console.log(`[FacebookService] Duplicating AdSet: ${adSetId} into Campaign: ${campaignId}`);
    
    // 1. Detect CBO if not provided
    let isCBO = parentCampaignIsCBO;
    if (isCBO === undefined) {
      try {
        const campaign = await this.withRetry(
          () => this.client.get(`/${campaignId}`, {
            params: { fields: 'bid_strategy,daily_budget,lifetime_budget,is_adset_budget_sharing_enabled,buying_type' }
          }),
          `duplicateAdSet:getCampaign(${campaignId})`
        );
        
        // is_adset_budget_sharing_enabled is the definitive flag for CBO
        isCBO = campaign.data.is_adset_budget_sharing_enabled === true || 
                !!(campaign.data.daily_budget && campaign.data.daily_budget !== "0" && campaign.data.daily_budget !== 0) || 
                !!(campaign.data.lifetime_budget && campaign.data.lifetime_budget !== "0" && campaign.data.lifetime_budget !== 0);
                
        console.log(`[FacebookService] CBO Detection for ${campaignId}: ${isCBO}`, campaign.data);
      } catch (error) {
        console.warn(`[FacebookService] Failed to detect CBO status for campaign ${campaignId}, defaulting to false`);
        isCBO = false;
      }
    }

    const original = await this.withRetry(
      () => this.client.get(`/${adSetId}`, {
        params: { fields: 'billing_event,optimization_goal,bid_amount,daily_budget,lifetime_budget,targeting,promoted_object,attribution_spec,optimization_sub_event,destination_type,bid_strategy' },
      }),
      `duplicateAdSet:read(${adSetId})`
    );

    const data = original.data;
    
    // Helper to build payload
    const buildPayload = (includeBudget: boolean) => {
      let payload: any = {
        name: newName,
        campaign_id: campaignId,
        status: 'PAUSED',
        billing_event: data.billing_event,
        optimization_goal: data.optimization_goal,
        targeting: data.targeting
      };

      if (includeBudget) {
        if (customBudget) {
          payload.daily_budget = customBudget;
        } else {
          if (data.daily_budget) payload.daily_budget = data.daily_budget;
          if (data.lifetime_budget) payload.lifetime_budget = data.lifetime_budget;
        }
        if (data.bid_strategy) payload.bid_strategy = data.bid_strategy;
        if (data.bid_amount) payload.bid_amount = data.bid_amount;
      }

      if (data.promoted_object) {
        const { id, smart_pse_enabled, ...sanitizedPromotedObject } = data.promoted_object;
        if (Object.keys(sanitizedPromotedObject).length > 0) {
          payload.promoted_object = sanitizedPromotedObject;
        }
      }

      if (data.targeting) {
        // Deep clone and sanitize targeting
        const sanitizedTargeting = JSON.parse(JSON.stringify(data.targeting));
        delete sanitizedTargeting.id;
        delete sanitizedTargeting.targeting_automation;
        delete sanitizedTargeting.contextual_targeting_options;
        payload.targeting = sanitizedTargeting;
      }

      if (data.attribution_spec) payload.attribution_spec = data.attribution_spec;
      if (data.optimization_sub_event) payload.optimization_sub_event = data.optimization_sub_event;
      if (data.destination_type) payload.destination_type = data.destination_type;

      return payload;
    };

    try {
      const payload = buildPayload(!isCBO);
      const response = await this.withRetry(
        () => this.client.post(`/${adAccountId}/adsets`, payload),
        `duplicateAdSet:create`
      );
      return response.data;
    } catch (error: any) {
      const fbError = error.response?.data?.error;
      if (fbError?.error_subcode === 1885621 || (fbError?.code === 100 && fbError?.message?.includes('budget'))) {
        console.warn(`[FacebookService] Budget conflict detected (CBO mismatch). Retrying WITHOUT budget fields...`);
        const retryPayload = buildPayload(false);
        const response = await this.withRetry(
          () => this.client.post(`/${adAccountId}/adsets`, retryPayload),
          `duplicateAdSet:create-noBudget`
        );
        return response.data;
      }
      console.error(`[FacebookService] AdSet Duplication Failed:`, error.response?.data || error.message);
      throw error;
    }
  }

  async duplicateAd(adId: string, newName: string, adSetId: string, adAccountId: string) {
    const original = await this.withRetry(
      () => this.client.get(`/${adId}`, { params: { fields: 'creative,tracking_specs' } }),
      `duplicateAd:read(${adId})`
    );

    const data = original.data;
    const payload: any = {
      name: newName,
      adset_id: adSetId,
      status: 'PAUSED',
      creative: { creative_id: data.creative.id },
    };
    if (data.tracking_specs) payload.tracking_specs = data.tracking_specs;

    const response = await this.withRetry(
      () => this.client.post(`/${adAccountId}/ads`, payload),
      `duplicateAd:create`
    );
    return response.data;
  }

  async duplicateAdSetDeep(adSetId: string, newName: string, campaignId: string, adAccountId: string, customBudget?: string) {
    const newAdSet = await this.duplicateAdSet(adSetId, newName, campaignId, adAccountId, customBudget);
    const ads = await this.getAds(adSetId);
    for (let i = 0; i < ads.length; i++) {
      if (i > 0) await sleep(200);
      await this.duplicateAd(ads[i].id, `${ads[i].name} - Copy`, newAdSet.id, adAccountId)
        .catch(err => console.warn(`[FacebookService] Failed to dup ad ${ads[i].id}:`, err.message));
    }
    return newAdSet;
  }

  async duplicateCampaignDeep(campaignId: string, campaignName: string, adAccountId: string, customBudget?: string) {
    const [original, adSets] = await Promise.all([
      this.withRetry(
        () => this.client.get(`/${campaignId}`, { params: { fields: 'bid_strategy,daily_budget,lifetime_budget' } }),
        `duplicateCampaignDeep:read(${campaignId})`
      ),
      this.getAdSets(campaignId),
    ]);

    const isCBO = !!(original.data.bid_strategy || original.data.daily_budget || original.data.lifetime_budget);
    const newCampaign = await this.duplicateCampaign(campaignId, campaignName, adAccountId, customBudget);

    for (let i = 0; i < adSets.length; i++) {
      if (i > 0) await sleep(400);
      const adSet = adSets[i];
      const newAdSet = await this.duplicateAdSet(adSet.id, `${adSet.name} - Copy`, newCampaign.id, adAccountId, customBudget, isCBO);
      const ads = await this.getAds(adSet.id);
      for (let j = 0; j < ads.length; j++) {
        if (j > 0) await sleep(200);
        await this.duplicateAd(ads[j].id, `${ads[j].name} - Copy`, newAdSet.id, adAccountId)
          .catch(err => console.warn(`[FacebookService] Failed to dup ad ${ads[j].id}:`, err.message));
      }
    }

    return newCampaign;
  }

  async updateName(id: string, newName: string) {
    console.log(`[FacebookService] Updating Name for ${id} to: ${newName}`);
    try {
      const response = await this.client.post(`/${id}`, {
        name: newName
      });
      return response.data;
    } catch (error: any) {
      console.error(`[FacebookService] Update Name Failed:`, error.response?.data || error.message);
      throw error;
    }
  }

  async uploadImage(adAccountId: string, fileBuffer: Buffer, filename: string): Promise<string> {
    const form = new FormData();
    form.append('filename', fileBuffer, { filename });
    const resp = await this.client.post(`/${adAccountId}/adimages`, form, {
      headers: form.getHeaders(),
    });
    const images = resp.data.images;
    const key = Object.keys(images)[0];
    return images[key].hash;
  }

  async uploadVideo(adAccountId: string, fileBuffer: Buffer, filename: string): Promise<string> {
    const form = new FormData();
    form.append('source', fileBuffer, { filename });
    const resp = await this.client.post(`/${adAccountId}/advideos`, form, {
      headers: form.getHeaders(),
    });
    return resp.data.id;
  }
}
