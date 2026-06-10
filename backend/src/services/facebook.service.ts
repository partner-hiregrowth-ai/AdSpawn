import axios from 'axios';
import FormData from 'form-data';
import { READ_ONLY_FIELDS } from './draft/MetaFieldRegistry';
import { sleep } from '../utils/sleep';

const FB_API_VERSION = 'v22.0';
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
              fields: 'name,id,status,creative{id,name,object_story_spec,asset_feed_spec,platform_customizations,instagram_user_id},tracking_specs',
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
        params: { fields: 'billing_event,optimization_goal,bid_amount,daily_budget,lifetime_budget,targeting,promoted_object,attribution_spec,optimization_sub_event,destination_type,bid_strategy,start_time,end_time' },
      }),
      `duplicateAdSet:read(${adSetId})`
    );

    const data = original.data;

    // If we're going to send lifetime_budget, Meta requires a future end_time
    // (>24h after start). When the source's end_time is missing or in the past
    // (typical for already-completed ad sets) we'd otherwise hit Meta error
    // 100/1487094. Auto-bump to start+30 days so the duplicate can be created.
    const usingLifetimeBudget = !!data.lifetime_budget;
    const MIN_END_BUFFER_MS = 25 * 60 * 60 * 1000; // 25h safety margin past start
    const DEFAULT_END_OFFSET_MS = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const sourceEndMs = data.end_time ? new Date(data.end_time).getTime() : NaN;
    const sourceStartMs = data.start_time ? new Date(data.start_time).getTime() : NaN;
    const startMs = !isNaN(sourceStartMs) && sourceStartMs > now ? sourceStartMs : now;
    let resolvedStart: string | undefined;
    let resolvedEnd: string | undefined;
    if (usingLifetimeBudget) {
      const needsBump = isNaN(sourceEndMs) || sourceEndMs < startMs + MIN_END_BUFFER_MS;
      resolvedEnd = needsBump
        ? new Date(startMs + DEFAULT_END_OFFSET_MS).toISOString()
        : data.end_time;
      // Only forward an explicit start_time if the source had one in the future;
      // otherwise let Meta default to "now" so we don't lock the new ad set to a stale start.
      if (!isNaN(sourceStartMs) && sourceStartMs > now) {
        resolvedStart = data.start_time;
      }
    } else {
      // Daily budget — Meta does NOT require end_time. Only carry the source values
      // over if they make sense in the future.
      if (!isNaN(sourceStartMs) && sourceStartMs > now) resolvedStart = data.start_time;
      if (!isNaN(sourceEndMs) && sourceEndMs > now) resolvedEnd = data.end_time;
    }

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

        // lifetime_budget *requires* end_time. daily_budget tolerates either.
        // resolvedEnd/resolvedStart were computed above with safe defaults.
        if (payload.lifetime_budget && resolvedEnd) payload.end_time = resolvedEnd;
        if (resolvedStart) payload.start_time = resolvedStart;
        if (!payload.lifetime_budget && resolvedEnd) payload.end_time = resolvedEnd;
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
        delete sanitizedTargeting.contextual_targeting_options;
        // Meta error 1870227 requires advantage_audience to be explicitly 0 or 1
        // on every new ad set. Preserve the source's setting; if missing, default
        // to OFF (0) so the ad set isn't unexpectedly opted into Advantage Audience.
        const sourceAA = data.targeting?.targeting_automation?.advantage_audience;
        sanitizedTargeting.targeting_automation = {
          advantage_audience: sourceAA === 1 ? 1 : 0,
        };
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

      // CBO mismatch — retry without budget (campaign owns it)
      if (fbError?.error_subcode === 1885621) {
        console.warn(`[FacebookService] CBO mismatch. Retrying WITHOUT budget fields...`);
        const retryPayload = buildPayload(false);
        const response = await this.withRetry(
          () => this.client.post(`/${adAccountId}/adsets`, retryPayload),
          `duplicateAdSet:create-noBudget`
        );
        return response.data;
      }

      // Budget too low — parse minimum from error and retry with it
      if (fbError?.error_subcode === 1885272) {
        const minMatch = fbError.error_user_msg?.match(/more than [^\d]*([\d,.]+)/);
        if (minMatch) {
          const minBudget = Math.ceil(parseFloat(minMatch[1].replace(/,/g, '')) * 100);
          console.warn(`[FacebookService] Budget too low. Retrying with minimum: ${minBudget} (cents)`);
          const retryPayload = buildPayload(!isCBO);
          if (retryPayload.lifetime_budget) retryPayload.lifetime_budget = String(minBudget);
          else if (retryPayload.daily_budget) retryPayload.daily_budget = String(minBudget);
          const response = await this.withRetry(
            () => this.client.post(`/${adAccountId}/adsets`, retryPayload),
            `duplicateAdSet:create-minBudget`
          );
          return response.data;
        }
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
    const creativeId = data.creative?.id || data.creative?.creative_id;
    if (!creativeId) {
      throw new Error(`Ad ${adId} has no creative to duplicate`);
    }
    const payload: any = {
      name: newName,
      adset_id: adSetId,
      status: 'PAUSED',
      creative: { creative_id: creativeId },
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

    // Track ad-set successes so we can roll back the empty campaign if NONE
    // succeed — otherwise the user is left with an orphan campaign on Meta
    // after every failed iteration.
    let successCount = 0;
    let lastError: Error | null = null;

    for (let i = 0; i < adSets.length; i++) {
      if (i > 0) await sleep(400);
      const adSet = adSets[i];
      try {
        const newAdSet = await this.duplicateAdSet(adSet.id, `${adSet.name} - Copy`, newCampaign.id, adAccountId, customBudget, isCBO);
        successCount++;
        const ads = await this.getAds(adSet.id);
        for (let j = 0; j < ads.length; j++) {
          if (j > 0) await sleep(200);
          await this.duplicateAd(ads[j].id, `${ads[j].name} - Copy`, newAdSet.id, adAccountId)
            .catch(err => console.warn(`[FacebookService] Failed to dup ad ${ads[j].id}:`, err.message));
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[FacebookService] Failed to dup ad set ${adSet.id}:`, err.response?.data?.error?.error_user_msg || err.message);
      }
    }

    if (successCount === 0 && adSets.length > 0) {
      // Roll back the empty campaign so the user's Meta account doesn't pile up
      // orphans. We swallow the delete error — at worst the user sees an empty
      // campaign they can clean up manually.
      try {
        await this.client.delete(`/${newCampaign.id}`);
        console.log(`[FacebookService] Rolled back empty campaign ${newCampaign.id} after ad-set duplication failed`);
      } catch (delErr: any) {
        console.warn(`[FacebookService] Failed to roll back empty campaign ${newCampaign.id}:`, delErr.message);
      }
      throw lastError ?? new Error('Failed to duplicate any ad sets');
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

  async uploadImage(adAccountId: string, fileBuffer: Buffer, filename: string): Promise<{ hash: string; id: string }> {
    const form = new FormData();
    form.append('filename', fileBuffer, { filename });
    const resp = await this.client.post(`/${adAccountId}/adimages`, form, {
      headers: form.getHeaders(),
    });
    const images = resp.data.images;
    const key = Object.keys(images)[0];
    return {
      hash: images[key].hash,
      id: images[key].id
    };
  }

  /**
   * Resumable Video Upload for Meta (handles large files > 4MB)
   * 1. Start session
   * 2. Upload chunks (we do one large chunk for simplicity as we have memoryBuffer)
   * 3. Finish session
   */
  async uploadVideo(adAccountId: string, fileBuffer: Buffer, filename: string): Promise<string> {
    const fileSize = fileBuffer.length;
    
    // Step 1: Initialize session
    const initResp = await this.client.post(`/${adAccountId}/advideos`, null, {
      params: {
        upload_phase: 'start',
        file_size: fileSize,
      }
    });
    const { upload_session_id, video_id } = initResp.data;

    // Step 2: Upload the file data
    // Meta resumable API expects the file in the 'video_file_chunk' param as binary
    const form = new FormData();
    form.append('upload_phase', 'transfer');
    form.append('upload_session_id', upload_session_id);
    form.append('start_offset', '0');
    form.append('video_file_chunk', fileBuffer, { filename });

    await this.client.post(`/${adAccountId}/advideos`, form, {
      headers: form.getHeaders(),
    });

    // Step 3: Finish upload
    await this.client.post(`/${adAccountId}/advideos`, null, {
      params: {
        upload_phase: 'finish',
        upload_session_id,
      }
    });

    return video_id;
  }

  async getAccountInsights(adAccountId: string, datePreset?: string, since?: string, until?: string) {
    const params: any = {
      fields: 'spend,impressions,clicks,ctr,cpc,cpm,actions,cost_per_action_type',
    };
    if (since && until) {
      params.time_range = JSON.stringify({ since, until });
    } else {
      params.date_preset = datePreset || 'last_7d';
    }
    const response = await this.withRetry(
      () => this.client.get(`/${adAccountId}/insights`, { params }),
      `getAccountInsights(${adAccountId})`
    );
    return response.data.data?.[0] || null;
  }

  async getAccountInsightsTimeSeries(adAccountId: string, datePreset?: string, since?: string, until?: string) {
    const params: any = {
      fields: 'spend,impressions,clicks',
      time_increment: 1,
      limit: 90,
    };
    if (since && until) {
      params.time_range = JSON.stringify({ since, until });
    } else {
      params.date_preset = datePreset || 'last_7d';
    }
    const response = await this.withRetry(
      () => this.client.get(`/${adAccountId}/insights`, { params }),
      `getAccountInsightsTimeSeries(${adAccountId})`
    );
    return response.data.data || [];
  }

  async getCampaignInsights(adAccountId: string, datePreset?: string, since?: string, until?: string, limit = 10) {
    const params: any = {
      fields: 'campaign_id,campaign_name,objective,spend,impressions,clicks,ctr,cpc,cpm',
      level: 'campaign',
      sort: ['spend_descending'],
      limit,
    };
    if (since && until) {
      params.time_range = JSON.stringify({ since, until });
    } else {
      params.date_preset = datePreset || 'last_7d';
    }
    const response = await this.withRetry(
      () => this.client.get(`/${adAccountId}/insights`, { params }),
      `getCampaignInsights(${adAccountId})`
    );
    return response.data.data || [];
  }
}
