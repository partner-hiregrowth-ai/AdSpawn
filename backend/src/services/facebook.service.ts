import axios from 'axios';
import { READ_ONLY_FIELDS } from './draft/MetaFieldRegistry';

const FB_API_VERSION = 'v19.0';
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

  async get(path: string, params: any = {}) {
    return this.client.get(path, { params });
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
        fields: 'name,id,status,objective,bid_strategy,daily_budget,lifetime_budget,start_time,stop_time,buying_type,special_ad_categories',
      },
    });
    return response.data.data;
  }

  async getAdSets(campaignId: string) {
    let allAdSets: any[] = [];
    let url: string | null = `/${campaignId}/adsets`;
    let isFirstPage = true;

    while (url) {
      try {
        let response: any;
        if (isFirstPage) {
          response = await this.client.get(url, {
            params: {
              fields: 'name,id,status,billing_event,optimization_goal,bid_amount,daily_budget,lifetime_budget,start_time,end_time,targeting,promoted_object,attribution_spec,optimization_sub_event,destination_type,bid_strategy',
              limit: 100
            }
          });
          isFirstPage = false;
        } else {
          response = await axios.get(url);
        }
        const data = response.data;
        if (data.data) allAdSets = [...allAdSets, ...data.data];
        url = data.paging?.next || null;
      } catch (error: any) {
        const errData = error.response?.data?.error || error.response?.data;
        console.error(`Failed to fetch ad sets page:`, errData || error.message);
        // Retry with backoff on rate limit (code 17)
        if (errData?.code === 17) {
          let retrySuccess = false;
          for (const delay of [10000, 20000]) {
            console.warn(`[FacebookService] Rate limited fetching ad sets, retrying in ${delay / 1000}s...`);
            await new Promise(r => setTimeout(r, delay));
            try {
              let retryResp: any;
              if (isFirstPage) {
                retryResp = await this.client.get(`/${campaignId}/adsets`, {
                  params: {
                    fields: 'name,id,status,billing_event,optimization_goal,bid_amount,daily_budget,lifetime_budget,start_time,end_time,targeting,promoted_object,attribution_spec,optimization_sub_event,destination_type,bid_strategy',
                    limit: 100
                  }
                });
                isFirstPage = false;
              } else {
                retryResp = await axios.get(url!);
              }
              const retryData = retryResp.data;
              if (retryData.data) allAdSets = [...allAdSets, ...retryData.data];
              url = retryData.paging?.next || null;
              retrySuccess = true;
              break;
            } catch {
              console.error(`[FacebookService] Rate limit retry failed (waited ${delay / 1000}s)`);
            }
          }
          if (retrySuccess) continue;
        }
        break;
      }
    }
    return allAdSets;
  }

  async getAds(adSetId: string) {
    let allAds: any[] = [];
    let url: string | null = `/${adSetId}/ads`;
    let isFirstPage = true;

    while (url) {
      try {
        let response: any;
        if (isFirstPage) {
          response = await this.client.get(url, {
            params: {
              fields: 'name,id,status,creative,tracking_specs',
              limit: 100
            }
          });
          isFirstPage = false;
        } else {
          response = await axios.get(url);
        }
        const data = response.data;
        if (data.data) allAds = [...allAds, ...data.data];
        url = data.paging?.next || null;
      } catch (error: any) {
        const errData = error.response?.data?.error || error.response?.data;
        console.error(`Failed to fetch ads page:`, errData || error.message);
        if (errData?.code === 17) {
          console.warn(`[FacebookService] Rate limited fetching ads, retrying in 10s...`);
          await new Promise(r => setTimeout(r, 10000));
          try {
            let retryResp: any;
            if (isFirstPage) {
              retryResp = await this.client.get(`/${adSetId}/ads`, {
                params: { fields: 'name,id,status,creative,tracking_specs', limit: 100 }
              });
              isFirstPage = false;
            } else {
              retryResp = await axios.get(url!);
            }
            const retryData = retryResp.data;
            if (retryData.data) allAds = [...allAds, ...retryData.data];
            url = retryData.paging?.next || null;
            continue;
          } catch {
            console.error(`[FacebookService] Rate limit retry failed for ads`);
          }
        }
        break;
      }
    }
    return allAds;
  }

  async duplicateCampaign(campaignId: string, newName: string, adAccountId: string, customBudget?: string) {
    console.log(`[FacebookService] Duplicating Campaign: ${campaignId}`);
    const original = await this.client.get(`/${campaignId}`, {
      params: {
        fields: 'objective,bid_strategy,buying_type,special_ad_categories,daily_budget,lifetime_budget',
      },
    });

    const data = original.data;
    let payload: any = {
      name: newName,
      objective: data.objective,
      status: 'PAUSED',
      special_ad_categories: data.special_ad_categories || [],
      is_adset_budget_sharing_enabled: false
    };

    if (data.buying_type) payload.buying_type = data.buying_type;
    
    // Handle Budget for Campaign (CBO)
    const isCBO = !!(data.bid_strategy || data.daily_budget || data.lifetime_budget);

    if (customBudget && isCBO) {
      payload.daily_budget = customBudget;
      if (data.bid_strategy) payload.bid_strategy = data.bid_strategy;
    } else if (data.bid_strategy) {
      payload.bid_strategy = data.bid_strategy;
      if (data.daily_budget) payload.daily_budget = data.daily_budget;
      if (data.lifetime_budget) payload.lifetime_budget = data.lifetime_budget;
      
      if (!payload.daily_budget && !payload.lifetime_budget) {
        payload.daily_budget = "100";
      }
    } else {
      if (data.daily_budget) payload.daily_budget = data.daily_budget;
      if (data.lifetime_budget) payload.lifetime_budget = data.lifetime_budget;
    }

    try {
      const response = await this.client.post(`/${adAccountId}/campaigns`, payload);
      return response.data;
    } catch (error: any) {
      console.error(`[FacebookService] Campaign Duplication Failed:`, error.response?.data || error.message);
      throw error;
    }
  }

  async duplicateAdSet(adSetId: string, newName: string, campaignId: string, adAccountId: string, customBudget?: string, parentCampaignIsCBO?: boolean) {
    console.log(`[FacebookService] Duplicating AdSet: ${adSetId} into Campaign: ${campaignId}`);
    
    // 1. Detect CBO if not provided
    let isCBO = parentCampaignIsCBO;
    if (isCBO === undefined) {
      try {
        const campaign = await this.client.get(`/${campaignId}`, {
          params: { fields: 'bid_strategy,daily_budget,lifetime_budget,is_adset_budget_sharing_enabled,buying_type' }
        });
        
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

    const original = await this.client.get(`/${adSetId}`, {
      params: {
        fields: 'billing_event,optimization_goal,bid_amount,daily_budget,lifetime_budget,targeting,promoted_object,attribution_spec,optimization_sub_event,destination_type,bid_strategy',
      },
    });

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
      // Try with budget if not CBO
      const payload = buildPayload(!isCBO);
      const response = await this.client.post(`/${adAccountId}/adsets`, payload);
      return response.data;
    } catch (error: any) {
      const fbError = error.response?.data?.error;
      
      // Handle "Budget Conflict" error (subcode 1885621)
      if (fbError?.error_subcode === 1885621 || (fbError?.code === 100 && fbError?.message?.includes('budget'))) {
        console.warn(`[FacebookService] Budget conflict detected (CBO mismatch). Retrying WITHOUT budget fields...`);
        try {
          const retryPayload = buildPayload(false);
          const response = await this.client.post(`/${adAccountId}/adsets`, retryPayload);
          console.log(`[FacebookService] Retry successful! AdSet duplicated without budget.`);
          return response.data;
        } catch (retryError: any) {
          console.error(`[FacebookService] Retry also failed:`, retryError.response?.data || retryError.message);
          throw retryError;
        }
      }

      console.error(`[FacebookService] AdSet Duplication Failed:`, error.response?.data || error.message);
      throw error;
    }
  }

  async duplicateAd(adId: string, newName: string, adSetId: string, adAccountId: string) {
    const original = await this.client.get(`/${adId}`, {
      params: {
        fields: 'creative,tracking_specs',
      },
    });

    const data = original.data;
    const payload: any = {
      name: newName,
      adset_id: adSetId,
      status: 'PAUSED',
      creative: { creative_id: data.creative.id },
    };

    if (data.tracking_specs) payload.tracking_specs = data.tracking_specs;

    try {
      const response = await this.client.post(`/${adAccountId}/ads`, payload);
      return response.data;
    } catch (error: any) {
      console.error(`[FacebookService] Ad Duplication Failed:`, error.response?.data || error.message);
      throw error;
    }
  }

  async duplicateAdSetDeep(adSetId: string, newName: string, campaignId: string, adAccountId: string, customBudget?: string) {
    const [newAdSet, ads] = await Promise.all([
      this.duplicateAdSet(adSetId, newName, campaignId, adAccountId, customBudget),
      this.getAds(adSetId),
    ]);

    if (ads.length > 0) {
      const BATCH = 5;
      for (let i = 0; i < ads.length; i += BATCH) {
        const batch = ads.slice(i, i + BATCH);
        await Promise.all(
          batch.map(ad =>
            this.duplicateAd(ad.id, `${ad.name} - Copy`, newAdSet.id, adAccountId)
              .catch(err => console.warn(`[FacebookService] Failed to dup ad ${ad.id}:`, err.message))
          )
        );
      }
    }

    return newAdSet;
  }

  async duplicateCampaignDeep(campaignId: string, campaignName: string, adAccountId: string, customBudget?: string) {
    const [original, adSets] = await Promise.all([
      this.client.get(`/${campaignId}`, {
        params: { fields: 'bid_strategy,daily_budget,lifetime_budget' }
      }),
      this.getAdSets(campaignId),
    ]);

    const isCBO = !!(original.data.bid_strategy || original.data.daily_budget || original.data.lifetime_budget);
    const newCampaign = await this.duplicateCampaign(campaignId, campaignName, adAccountId, customBudget);

    const BATCH = 3;
    for (let i = 0; i < adSets.length; i += BATCH) {
      const batch = adSets.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (adSet) => {
          const [newAdSet, ads] = await Promise.all([
            this.duplicateAdSet(adSet.id, `${adSet.name} - Copy`, newCampaign.id, adAccountId, customBudget, isCBO),
            this.getAds(adSet.id),
          ]);
          if (ads.length > 0) {
            const AD_BATCH = 5;
            for (let j = 0; j < ads.length; j += AD_BATCH) {
              const adBatch = ads.slice(j, j + AD_BATCH);
              await Promise.all(
                adBatch.map(ad =>
                  this.duplicateAd(ad.id, `${ad.name} - Copy`, newAdSet.id, adAccountId)
                    .catch(err => console.warn(`[FacebookService] Failed to dup ad ${ad.id}:`, err.message))
                )
              );
            }
          }
        })
      );
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
}
