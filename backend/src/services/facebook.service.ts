import axios from 'axios';

const FB_API_VERSION = 'v19.0';
const FB_BASE_URL = `https://graph.facebook.com/${FB_API_VERSION}`;

export class FacebookService {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private get client() {
    return axios.create({
      baseURL: FB_BASE_URL,
      params: {
        access_token: this.accessToken,
      },
    });
  }

  async getAdAccounts() {
    const response = await this.client.get('/me/adaccounts', {
      params: {
        fields: 'name,account_id,id,currency,timezone_name',
      },
    });
    return response.data.data;
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
    const response = await this.client.get(`/${campaignId}/adsets`, {
      params: {
        fields: 'name,id,status,billing_event,optimization_goal,bid_amount,daily_budget,lifetime_budget,targeting,promoted_object,attribution_spec,optimization_sub_event,destination_type,bid_strategy',
      },
    });
    return response.data.data;
  }

  async getAds(adSetId: string) {
    const response = await this.client.get(`/${adSetId}/ads`, {
      params: {
        fields: 'name,id,status,creative,tracking_specs,recommendations',
      },
    });
    return response.data.data;
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

  async duplicateAdSet(adSetId: string, newName: string, campaignId: string, adAccountId: string, customBudget?: string, parentCampaignIsCBO: boolean = false) {
    console.log(`[FacebookService] Duplicating AdSet: ${adSetId} (Parent CBO: ${parentCampaignIsCBO})`);
    const original = await this.client.get(`/${adSetId}`, {
      params: {
        fields: 'billing_event,optimization_goal,bid_amount,daily_budget,lifetime_budget,targeting,promoted_object,attribution_spec,optimization_sub_event,destination_type,bid_strategy',
      },
    });

    const data = original.data;
    let payload: any = {
      name: newName,
      campaign_id: campaignId,
      status: 'PAUSED',
      billing_event: data.billing_event,
      optimization_goal: data.optimization_goal,
      targeting: data.targeting,
      is_adset_budget_sharing_enabled: false
    };

    // ONLY apply budget to AdSet if the campaign is NOT CBO
    if (!parentCampaignIsCBO) {
      if (customBudget) {
        payload.daily_budget = customBudget;
      } else {
        if (data.daily_budget) payload.daily_budget = data.daily_budget;
        if (data.lifetime_budget) payload.lifetime_budget = data.lifetime_budget;
      }
    } else {
      delete payload.daily_budget;
      delete payload.lifetime_budget;
    }

    if (data.bid_amount) payload.bid_amount = data.bid_amount;
    if (data.promoted_object) payload.promoted_object = data.promoted_object;
    if (data.attribution_spec) payload.attribution_spec = data.attribution_spec;
    if (data.optimization_sub_event) payload.optimization_sub_event = data.optimization_sub_event;
    if (data.destination_type) payload.destination_type = data.destination_type;
    if (data.bid_strategy) payload.bid_strategy = data.bid_strategy;

    try {
      const response = await this.client.post(`/${adAccountId}/adsets`, payload);
      return response.data;
    } catch (error: any) {
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

  async duplicateCampaignDeep(campaignId: string, campaignName: string, adAccountId: string, customBudget?: string) {
    // 1. Fetch original campaign to check if it's CBO
    const original = await this.client.get(`/${campaignId}`, {
      params: { fields: 'bid_strategy,daily_budget,lifetime_budget' }
    });
    const isCBO = !!(original.data.bid_strategy || original.data.daily_budget || original.data.lifetime_budget);
    
    // 2. Duplicate Campaign
    const newCampaign = await this.duplicateCampaign(campaignId, campaignName, adAccountId, customBudget);
    
    // 3. Fetch Ad Sets
    const adSets = await this.getAdSets(campaignId);
    
    for (const adSet of adSets) {
      // 4. Duplicate Ad Set (Pass isCBO flag to prevent budget conflict)
      const newAdSet = await this.duplicateAdSet(adSet.id, `${adSet.name} - Copy`, newCampaign.id, adAccountId, customBudget, isCBO);
      
      // 5. Duplicate Ads
      const ads = await this.getAds(adSet.id);
      for (const ad of ads) {
        await this.duplicateAd(ad.id, `${ad.name} - Copy`, newAdSet.id, adAccountId);
      }
    }

    return newCampaign;
  }
}
