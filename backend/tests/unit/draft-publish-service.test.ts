import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DraftStatus } from '@prisma/client';

vi.mock('../../src/prisma', () => ({
  prisma: {
    draftCampaign: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    draftAdSet: {
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    draftAd: {
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    draftPublishLog: {
      create: vi.fn(),
    },
  },
}));

let mockFbPost: ReturnType<typeof vi.fn>;
let mockFbGet: ReturnType<typeof vi.fn>;
let mockFbDelete: ReturnType<typeof vi.fn>;
let mockCheckExistence: ReturnType<typeof vi.fn>;

vi.mock('../../src/services/facebook.service', () => ({
  FacebookService: vi.fn().mockImplementation(function () {
    return {
      client: {
        post: (...args: any[]) => mockFbPost(...args),
        get: (...args: any[]) => mockFbGet(...args),
        delete: (...args: any[]) => mockFbDelete(...args),
      },
      checkExistence: (...args: any[]) => mockCheckExistence(...args),
    };
  }),
}));

let mockValidateFullDraft: ReturnType<typeof vi.fn>;

vi.mock('../../src/services/draft/DraftValidationEngine', () => ({
  DraftValidationEngine: {
    validateFullDraft: (...args: any[]) => mockValidateFullDraft(...args),
  },
}));

import { prisma } from '../../src/prisma';
import { DraftPublishService } from '../../src/services/draft/DraftPublishService';

const mockPrisma = prisma as any;

function makeDraftCampaign(overrides: any = {}) {
  return {
    id: 'camp-1',
    name: 'Test Campaign',
    objective: 'OUTCOME_TRAFFIC',
    adAccountId: 'act_123456',
    metaId: null,
    data: {
      objective: 'OUTCOME_TRAFFIC',
      special_ad_categories: ['NONE'],
    },
    adSets: [{
      id: 'adset-1',
      name: 'Test AdSet',
      adAccountId: 'act_123456',
      metaId: null,
      data: {
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'LINK_CLICKS',
        targeting: { geo_locations: { countries: ['TH'] } },
      },
      ads: [{
        id: 'ad-1',
        name: 'Test Ad',
        adAccountId: 'act_123456',
        metaId: null,
        data: {
          creative: { creative_id: '999' },
        },
      }],
    }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFbPost = vi.fn();
  mockFbGet = vi.fn().mockResolvedValue({ data: {} });
  mockFbDelete = vi.fn().mockResolvedValue({});
  mockCheckExistence = vi.fn().mockResolvedValue(true);
  mockValidateFullDraft = vi.fn().mockResolvedValue({
    isValid: true,
    campaignErrors: [],
    adSetErrors: {},
    adErrors: {},
  });
  mockPrisma.draftCampaign.updateMany.mockResolvedValue({ count: 1 });
});

describe('DraftPublishService.publishCampaign', () => {
  it('throws if no access token', async () => {
    await expect(DraftPublishService.publishCampaign('camp-1', ''))
      .rejects.toThrow('No Facebook access token');
  });

  it('throws if campaign not found', async () => {
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(null);
    await expect(DraftPublishService.publishCampaign('camp-1', 'token'))
      .rejects.toThrow('Campaign draft not found');
  });

  it('throws on validation failure', async () => {
    mockValidateFullDraft.mockResolvedValueOnce({
      isValid: false,
      campaignErrors: [{ field: 'creative', message: 'Creative required', severity: 'error' }],
      adSetErrors: {},
      adErrors: {},
    });
    const campaign = makeDraftCampaign();
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    await expect(DraftPublishService.publishCampaign('camp-1', 'token'))
      .rejects.toThrow('Validation failed');
  });

  it('creates new campaign, adset, and ad on Meta', async () => {
    const campaign = makeDraftCampaign();
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    const result = await DraftPublishService.publishCampaign('camp-1', 'token');
    expect(result.success).toBe(true);
    expect(result.metaCampaignId).toBe('meta_camp_1');
    expect(mockFbPost).toHaveBeenCalledTimes(3);
  });

  it('updates existing campaign if metaId exists and object found', async () => {
    const campaign = makeDraftCampaign({ metaId: 'existing_camp' });
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});
    mockCheckExistence.mockResolvedValue(true);

    mockFbPost
      .mockResolvedValueOnce({}) // campaign update
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    const result = await DraftPublishService.publishCampaign('camp-1', 'token');
    expect(result.success).toBe(true);
    expect(result.metaCampaignId).toBe('existing_camp');
    expect(mockCheckExistence).toHaveBeenCalledWith('existing_camp');
  });

  it('recreates campaign if metaId exists but not found on Meta', async () => {
    const campaign = makeDraftCampaign({ metaId: 'gone_camp' });
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});
    mockCheckExistence.mockResolvedValue(false);

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'new_camp' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    const result = await DraftPublishService.publishCampaign('camp-1', 'token');
    expect(result.success).toBe(true);
    expect(result.metaCampaignId).toBe('new_camp');
  });

  it('handles existing adset metaId (update)', async () => {
    const campaign = makeDraftCampaign();
    campaign.adSets[0].metaId = 'existing_adset';
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});
    mockCheckExistence.mockResolvedValue(true);

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({}) // adset update
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    const result = await DraftPublishService.publishCampaign('camp-1', 'token');
    expect(result.success).toBe(true);
  });

  it('recreates adset when metaId not found on Meta', async () => {
    const campaign = makeDraftCampaign();
    campaign.adSets[0].metaId = 'gone_adset';
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});
    mockCheckExistence.mockResolvedValue(false);

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'new_adset' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    const result = await DraftPublishService.publishCampaign('camp-1', 'token');
    expect(result.success).toBe(true);
  });

  it('handles existing ad metaId (skips create)', async () => {
    const campaign = makeDraftCampaign();
    campaign.adSets[0].ads[0].metaId = 'existing_ad';
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});
    mockCheckExistence.mockResolvedValue(true);

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } });

    const result = await DraftPublishService.publishCampaign('camp-1', 'token');
    expect(result.success).toBe(true);
  });

  it('recreates ad when metaId not found on Meta', async () => {
    const campaign = makeDraftCampaign();
    campaign.adSets[0].ads[0].metaId = 'gone_ad';
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});
    mockCheckExistence.mockResolvedValue(false);

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'new_ad' } });

    const result = await DraftPublishService.publishCampaign('camp-1', 'token');
    expect(result.success).toBe(true);
  });

  it('handles CBO campaign (includes budget in campaign payload)', async () => {
    const campaign = makeDraftCampaign();
    campaign.data.daily_budget = '5000';
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    await DraftPublishService.publishCampaign('camp-1', 'token');
    const campaignCall = mockFbPost.mock.calls[0];
    expect(campaignCall[1]).toHaveProperty('daily_budget', '5000');
  });

  it('creates CBO campaign with both budgets (prefers daily) and bid_strategy', async () => {
    const campaign = makeDraftCampaign({
      data: {
        objective: 'OUTCOME_TRAFFIC',
        special_ad_categories: ['NONE'],
        daily_budget: '10000',
        lifetime_budget: '50000',
        bid_strategy: 'COST_CAP',
      },
    });
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    await DraftPublishService.publishCampaign('camp-1', 'token');
    const campaignCall = mockFbPost.mock.calls[0];
    expect(campaignCall[1]).toHaveProperty('daily_budget', '10000');
    expect(campaignCall[1]).not.toHaveProperty('lifetime_budget');
    expect(campaignCall[1]).toHaveProperty('bid_strategy', 'COST_CAP');
  });

  it('handles lifetime_budget campaign', async () => {
    const campaign = makeDraftCampaign();
    campaign.data.lifetime_budget = '50000';
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    await DraftPublishService.publishCampaign('camp-1', 'token');
    const campaignCall = mockFbPost.mock.calls[0];
    expect(campaignCall[1]).toHaveProperty('lifetime_budget', '50000');
  });

  it('normalizes adAccountId without act_ prefix', async () => {
    const campaign = makeDraftCampaign({ adAccountId: '123456' });
    campaign.adSets[0].adAccountId = '123456';
    campaign.adSets[0].ads[0].adAccountId = '123456';
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    await DraftPublishService.publishCampaign('camp-1', 'token');
    expect(mockFbPost.mock.calls[0][0]).toBe('/act_123456/campaigns');
  });

  it('handles Facebook API error on campaign create', async () => {
    const campaign = makeDraftCampaign();
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.updateMany.mockResolvedValue({});
    mockPrisma.draftAd.updateMany.mockResolvedValue({});
    mockPrisma.draftPublishLog.create.mockResolvedValue({});

    mockFbPost.mockRejectedValue({
      response: { data: { error: { message: 'Invalid token', code: 190, error_subcode: 463, error_user_msg: 'Token expired' } } },
    });

    await expect(DraftPublishService.publishCampaign('camp-1', 'token'))
      .rejects.toThrow('Campaign error');
  });

  it('marks entities as FAILED on error', async () => {
    const campaign = makeDraftCampaign();
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.updateMany.mockResolvedValue({});
    mockPrisma.draftAd.updateMany.mockResolvedValue({});
    mockPrisma.draftPublishLog.create.mockResolvedValue({});

    mockFbPost.mockRejectedValue(new Error('Network error'));

    await expect(DraftPublishService.publishCampaign('camp-1', 'token')).rejects.toThrow();
    expect(mockPrisma.draftCampaign.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: DraftStatus.FAILED } })
    );
    expect(mockPrisma.draftPublishLog.create).toHaveBeenCalled();
  });

  it('creates ad set with non-CBO budget fields', async () => {
    const campaign = makeDraftCampaign();
    campaign.data = { objective: 'OUTCOME_TRAFFIC', special_ad_categories: ['NONE'] };
    campaign.adSets[0].data.daily_budget = '3000';
    campaign.adSets[0].data.bid_strategy = 'COST_CAP';
    campaign.adSets[0].data.bid_amount = '500';
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    await DraftPublishService.publishCampaign('camp-1', 'token');
    const adSetCall = mockFbPost.mock.calls[1];
    expect(adSetCall[1]).toHaveProperty('daily_budget', '3000');
    expect(adSetCall[1]).toHaveProperty('bid_strategy', 'COST_CAP');
    expect(adSetCall[1]).toHaveProperty('bid_amount', '500');
  });

  it('retries adset creation on CBO conflict subcode', async () => {
    const campaign = makeDraftCampaign();
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockRejectedValueOnce({
        response: { data: { error: { message: 'Budget conflict', code: 100, error_subcode: 2490487 } } },
      })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_retry' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    const result = await DraftPublishService.publishCampaign('camp-1', 'token');
    expect(result.success).toBe(true);
  });

  it('includes tracking_specs in ad payload', async () => {
    const campaign = makeDraftCampaign();
    campaign.adSets[0].ads[0].data.tracking_specs = [{ 'action.type': ['offsite_conversion'] }];
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    await DraftPublishService.publishCampaign('camp-1', 'token');
    const adCall = mockFbPost.mock.calls[2];
    expect(adCall[1]).toHaveProperty('tracking_specs');
  });

  it('throws on ad without creative_id during publish', async () => {
    // Give a valid creative_id for validation but make it empty at publish time
    // by having creative with id (passes validation) but no creative_id (fails publish)
    const campaign = makeDraftCampaign();
    // creative.id passes validation but createMetaAd needs creative_id or id
    campaign.adSets[0].ads[0].data = { creative: { id: '123' } };
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    // This should succeed since creative.id is used as creativeId
    const result = await DraftPublishService.publishCampaign('camp-1', 'token');
    expect(result.success).toBe(true);
    const adCall = mockFbPost.mock.calls[2];
    expect(adCall[1].creative.creative_id).toBe('123');
  });

  it('includes attribution_spec for supported objectives', async () => {
    const campaign = makeDraftCampaign();
    campaign.data.objective = 'OUTCOME_SALES';
    campaign.objective = 'OUTCOME_SALES';
    campaign.adSets[0].data.optimization_goal = 'OFFSITE_CONVERSIONS';
    campaign.adSets[0].data.promoted_object = { pixel_id: '123' };
    campaign.adSets[0].data.attribution_spec = [{ event_type: 'CLICK_THROUGH', window_days: 7 }];
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    await DraftPublishService.publishCampaign('camp-1', 'token');
    const adSetCall = mockFbPost.mock.calls[1];
    expect(adSetCall[1]).toHaveProperty('attribution_spec');
  });

  it('includes promoted_object for OUTCOME_LEADS', async () => {
    const campaign = makeDraftCampaign();
    campaign.data.objective = 'OUTCOME_LEADS';
    campaign.objective = 'OUTCOME_LEADS';
    campaign.adSets[0].data.optimization_goal = 'LEAD_GENERATION';
    campaign.adSets[0].data.promoted_object = { page_id: '12345' };
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    await DraftPublishService.publishCampaign('camp-1', 'token');
    const adSetCall = mockFbPost.mock.calls[1];
    expect(adSetCall[1]).toHaveProperty('promoted_object');
  });

  it('includes destination_type when valid for objective', async () => {
    const campaign = makeDraftCampaign();
    campaign.adSets[0].data.destination_type = 'WEBSITE';
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    await DraftPublishService.publishCampaign('camp-1', 'token');
    const adSetCall = mockFbPost.mock.calls[1];
    expect(adSetCall[1]).toHaveProperty('destination_type', 'WEBSITE');
  });

  it('omits destination_type for AWARENESS (UNDEFINED not sent)', async () => {
    const campaign = makeDraftCampaign();
    campaign.data = { objective: 'OUTCOME_AWARENESS', special_ad_categories: ['NONE'] };
    campaign.objective = 'OUTCOME_AWARENESS';
    campaign.adSets[0].data.optimization_goal = 'REACH';
    campaign.adSets[0].data.destination_type = 'UNDEFINED';
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    await DraftPublishService.publishCampaign('camp-1', 'token');
    const adSetCall = mockFbPost.mock.calls[1];
    expect(adSetCall[1]).not.toHaveProperty('destination_type');
  });

  it('infers destination_type from optimization_goal for ENGAGEMENT', async () => {
    const campaign = makeDraftCampaign();
    campaign.data = { objective: 'OUTCOME_ENGAGEMENT', special_ad_categories: ['NONE'] };
    campaign.objective = 'OUTCOME_ENGAGEMENT';
    campaign.adSets[0].data.optimization_goal = 'POST_ENGAGEMENT';
    campaign.adSets[0].data.destination_type = 'WEBSITE';
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    await DraftPublishService.publishCampaign('camp-1', 'token');
    const adSetCall = mockFbPost.mock.calls[1];
    expect(adSetCall[1]).toHaveProperty('destination_type', 'ON_POST');
  });

  it('infers ON_VIDEO destination_type for ENGAGEMENT with VIDEO_VIEWS goal', async () => {
    const campaign = makeDraftCampaign();
    campaign.data = { objective: 'OUTCOME_ENGAGEMENT', special_ad_categories: ['NONE'] };
    campaign.objective = 'OUTCOME_ENGAGEMENT';
    campaign.adSets[0].data.optimization_goal = 'VIDEO_VIEWS';
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    await DraftPublishService.publishCampaign('camp-1', 'token');
    const adSetCall = mockFbPost.mock.calls[1];
    expect(adSetCall[1]).toHaveProperty('destination_type', 'ON_VIDEO');
  });

  it('infers FACEBOOK destination_type for ENGAGEMENT with MESSAGES goal', async () => {
    const campaign = makeDraftCampaign();
    campaign.data = { objective: 'OUTCOME_ENGAGEMENT', special_ad_categories: ['NONE'] };
    campaign.objective = 'OUTCOME_ENGAGEMENT';
    campaign.adSets[0].data.optimization_goal = 'MESSAGES';
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    await DraftPublishService.publishCampaign('camp-1', 'token');
    const adSetCall = mockFbPost.mock.calls[1];
    expect(adSetCall[1]).toHaveProperty('destination_type', 'FACEBOOK');
  });

  it('infers WEBSITE destination_type for ENGAGEMENT with LINK_CLICKS goal', async () => {
    const campaign = makeDraftCampaign();
    campaign.data = { objective: 'OUTCOME_ENGAGEMENT', special_ad_categories: ['NONE'] };
    campaign.objective = 'OUTCOME_ENGAGEMENT';
    campaign.adSets[0].data.optimization_goal = 'LINK_CLICKS';
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    await DraftPublishService.publishCampaign('camp-1', 'token');
    const adSetCall = mockFbPost.mock.calls[1];
    expect(adSetCall[1]).toHaveProperty('destination_type', 'WEBSITE');
  });

  it('handles checkObjectiveMismatch GET failure gracefully', async () => {
    const campaign = makeDraftCampaign({ metaId: 'existing_camp' });
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});
    mockCheckExistence.mockResolvedValue(true);
    mockFbGet.mockRejectedValueOnce(new Error('Network failure'));

    mockFbPost
      .mockResolvedValueOnce({}) // campaign update (existing)
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    await DraftPublishService.publishCampaign('camp-1', 'token');
    expect(mockFbDelete).not.toHaveBeenCalled();
  });

  it('includes bid_amount for CBO campaign with COST_CAP strategy', async () => {
    const campaign = makeDraftCampaign();
    campaign.data = {
      objective: 'OUTCOME_TRAFFIC',
      special_ad_categories: ['NONE'],
      daily_budget: '10000',
      bid_strategy: 'COST_CAP',
      bid_amount: '500',
      is_adset_budget_sharing_enabled: true,
    };
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    await DraftPublishService.publishCampaign('camp-1', 'token');
    const campaignCall = mockFbPost.mock.calls[0];
    expect(campaignCall[1]).toHaveProperty('bid_strategy', 'COST_CAP');
    expect(campaignCall[1]).toHaveProperty('bid_amount', '500');
  });

  it('adds custom_event_type for SALES when only pixel_id provided', async () => {
    const campaign = makeDraftCampaign();
    campaign.data = { objective: 'OUTCOME_SALES', special_ad_categories: ['NONE'] };
    campaign.objective = 'OUTCOME_SALES';
    campaign.adSets[0].data.optimization_goal = 'OFFSITE_CONVERSIONS';
    campaign.adSets[0].data.promoted_object = { pixel_id: '12345' };
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    await DraftPublishService.publishCampaign('camp-1', 'token');
    const adSetCall = mockFbPost.mock.calls[1];
    expect(adSetCall[1].promoted_object).toEqual({ pixel_id: '12345', custom_event_type: 'PURCHASE' });
  });

  it('injects page_id into object_story_spec from adSet promoted_object', async () => {
    const campaign = makeDraftCampaign();
    campaign.adSets[0].data.promoted_object = { page_id: '999' };
    campaign.adSets[0].ads[0].data = {
      creative: { object_story_spec: { link_data: { link: 'http://example.com' } } },
    };
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    await DraftPublishService.publishCampaign('camp-1', 'token');
    const adCall = mockFbPost.mock.calls[2];
    expect(adCall[1].creative.object_story_spec.page_id).toBe('999');
  });

  it('injects page_id from adSet.data.page_id when promoted_object has no page_id', async () => {
    const campaign = makeDraftCampaign();
    campaign.adSets[0].data.page_id = '888';
    campaign.adSets[0].ads[0].data = {
      creative: { object_story_spec: { link_data: { link: 'http://example.com' } } },
    };
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    await DraftPublishService.publishCampaign('camp-1', 'token');
    const adCall = mockFbPost.mock.calls[2];
    expect(adCall[1].creative.object_story_spec.page_id).toBe('888');
  });

  it('passes video_data through in object_story_spec', async () => {
    const campaign = makeDraftCampaign();
    campaign.adSets[0].data.promoted_object = { page_id: '111' };
    campaign.adSets[0].ads[0].data = {
      creative: { object_story_spec: { page_id: '111', video_data: { video_id: '456', message: 'Watch this' } } },
    };
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});
    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    await DraftPublishService.publishCampaign('camp-1', 'token');
    const adCall = mockFbPost.mock.calls[2];
    expect(adCall[1].creative.object_story_spec.video_data).toEqual({ video_id: '456', message: 'Watch this' });
  });

  it('passes photo_data through in object_story_spec', async () => {
    const campaign = makeDraftCampaign();
    campaign.adSets[0].ads[0].data = {
      creative: { object_story_spec: { page_id: '111', photo_data: { image_hash: 'abc', message: 'Look at this' } } },
    };
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});
    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    await DraftPublishService.publishCampaign('camp-1', 'token');
    const adCall = mockFbPost.mock.calls[2];
    expect(adCall[1].creative.object_story_spec.photo_data).toEqual({ image_hash: 'abc', message: 'Look at this' });
  });

  it('passes child_attachments through in link_data for carousel', async () => {
    const cards = [{ link: 'https://a.com', name: 'A' }, { link: 'https://b.com', name: 'B' }];
    const campaign = makeDraftCampaign();
    campaign.adSets[0].ads[0].data = {
      creative: { object_story_spec: { page_id: '111', link_data: { message: 'hi', child_attachments: cards } } },
    };
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});
    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    await DraftPublishService.publishCampaign('camp-1', 'token');
    const adCall = mockFbPost.mock.calls[2];
    expect(adCall[1].creative.object_story_spec.link_data.child_attachments).toEqual(cards);
  });

  it('includes platform_customizations as top-level creative field', async () => {
    const campaign = makeDraftCampaign();
    campaign.adSets[0].ads[0].data = {
      creative: {
        creative_id: '999',
        platform_customizations: { instagram: { title: 'IG Title' } },
      },
    };
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});
    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    await DraftPublishService.publishCampaign('camp-1', 'token');
    const adCall = mockFbPost.mock.calls[2];
    expect(adCall[1].creative.platform_customizations).toEqual({ instagram: { title: 'IG Title' } });
  });

  it('includes asset_feed_spec as top-level creative field', async () => {
    const campaign = makeDraftCampaign();
    campaign.adSets[0].ads[0].data = {
      creative: {
        creative_id: '999',
        asset_feed_spec: { images: [{ hash: 'x' }], bodies: [{ text: 'y' }] },
      },
    };
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});
    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    await DraftPublishService.publishCampaign('camp-1', 'token');
    const adCall = mockFbPost.mock.calls[2];
    expect(adCall[1].creative.asset_feed_spec).toEqual({ images: [{ hash: 'x' }], bodies: [{ text: 'y' }] });
  });

  it('strips creative_type from publish payload', async () => {
    const campaign = makeDraftCampaign();
    campaign.adSets[0].ads[0].data = {
      creative: {
        creative_type: 'video',
        object_story_spec: { page_id: '111', video_data: { video_id: '456' } },
      },
    };
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});
    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    await DraftPublishService.publishCampaign('camp-1', 'token');
    const adCall = mockFbPost.mock.calls[2];
    expect(adCall[1].creative.creative_type).toBeUndefined();
  });

  it('accepts asset_feed_spec-only creative without object_story_spec', async () => {
    const campaign = makeDraftCampaign();
    campaign.adSets[0].ads[0].data = {
      creative: { asset_feed_spec: { images: [{ hash: 'x' }], bodies: [{ text: 'y' }] } },
    };
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});
    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    await DraftPublishService.publishCampaign('camp-1', 'token');
    const adCall = mockFbPost.mock.calls[2];
    expect(adCall[1].creative.asset_feed_spec).toEqual({ images: [{ hash: 'x' }], bodies: [{ text: 'y' }] });
    expect(adCall[1].creative.creative_id).toBeUndefined();
  });

  it('deletes and recreates campaign on objective mismatch, clears child metaIds', async () => {
    const campaign = makeDraftCampaign({ metaId: 'existing_camp' });
    campaign.data.objective = 'OUTCOME_LEADS';
    campaign.objective = 'OUTCOME_LEADS';
    campaign.adSets[0].metaId = 'old_adset_meta';
    campaign.adSets[0].ads[0].metaId = 'old_ad_meta';
    campaign.adSets[0].data.promoted_object = { page_id: '123' };
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});
    mockCheckExistence.mockResolvedValue(true);
    mockFbGet.mockResolvedValueOnce({ data: { objective: 'OUTCOME_TRAFFIC' } });
    mockFbDelete.mockResolvedValueOnce({});

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'new_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    await DraftPublishService.publishCampaign('camp-1', 'token');
    expect(mockFbDelete).toHaveBeenCalledWith('/existing_camp');
    expect(mockPrisma.draftAdSet.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'adset-1' }, data: expect.objectContaining({ metaId: null }) })
    );
    expect(mockPrisma.draftAd.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ad-1' }, data: { metaId: null } })
    );
    const campaignCall = mockFbPost.mock.calls[0];
    expect(campaignCall[1].objective).toBe('OUTCOME_LEADS');
  });

  it('continues publishing when deleteMetaCampaign fails', async () => {
    const campaign = makeDraftCampaign({ metaId: 'existing_camp' });
    campaign.data.objective = 'OUTCOME_LEADS';
    campaign.objective = 'OUTCOME_LEADS';
    campaign.adSets[0].data.promoted_object = { page_id: '123' };
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});
    mockCheckExistence.mockResolvedValue(true);
    mockFbGet.mockResolvedValueOnce({ data: { objective: 'OUTCOME_TRAFFIC' } });
    mockFbDelete.mockRejectedValueOnce(new Error('Network error'));

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'new_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    await DraftPublishService.publishCampaign('camp-1', 'token');
    expect(mockFbDelete).toHaveBeenCalledWith('/existing_camp');
    expect(mockFbPost).toHaveBeenCalled();
  });

  it('handles adset with lifetime_budget and end_time', async () => {
    const campaign = makeDraftCampaign();
    campaign.data = { objective: 'OUTCOME_TRAFFIC', special_ad_categories: ['NONE'] };
    campaign.adSets[0].data.lifetime_budget = '50000';
    campaign.adSets[0].data.end_time = '2026-12-31';
    campaign.adSets[0].data.start_time = '2026-01-01';
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    await DraftPublishService.publishCampaign('camp-1', 'token');
    const adSetCall = mockFbPost.mock.calls[1];
    expect(adSetCall[1]).toHaveProperty('lifetime_budget', '50000');
    expect(adSetCall[1]).toHaveProperty('end_time', '2026-12-31');
    expect(adSetCall[1]).toHaveProperty('start_time', '2026-01-01');
  });

  it('includes buying_type in campaign payload', async () => {
    const campaign = makeDraftCampaign();
    campaign.data.buying_type = 'RESERVED';
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    await DraftPublishService.publishCampaign('camp-1', 'token');
    const campaignCall = mockFbPost.mock.calls[0];
    expect(campaignCall[1]).toHaveProperty('buying_type', 'RESERVED');
  });

  it('includes spend_cap in campaign payload', async () => {
    const campaign = makeDraftCampaign();
    campaign.data.daily_budget = '5000';
    campaign.data.spend_cap = '100000';
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    await DraftPublishService.publishCampaign('camp-1', 'token');
    const campaignCall = mockFbPost.mock.calls[0];
    expect(campaignCall[1]).toHaveProperty('spend_cap', '100000');
  });

  it('retries adset on CBO conflict subcode 1815857 and fails on retry', async () => {
    const campaign = makeDraftCampaign();
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});
    mockPrisma.draftAdSet.updateMany.mockResolvedValue({});
    mockPrisma.draftAd.updateMany.mockResolvedValue({});
    mockPrisma.draftPublishLog.create.mockResolvedValue({});

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockRejectedValueOnce({
        response: { data: { error: { message: 'Bid conflict', code: 100, error_subcode: 1815857 } } },
      })
      .mockRejectedValueOnce({
        response: { data: { error: { message: 'Still failing retry 1', code: 100, error_subcode: 999 } } },
      })
      .mockRejectedValueOnce({
        response: { data: { error: { message: 'Still failing retry 2', code: 100, error_subcode: 999 } } },
      });

    await expect(DraftPublishService.publishCampaign('camp-1', 'token'))
      .rejects.toThrow('Ad Set error');
  });

  it('falls back to LOWEST_COST_WITHOUT_CAP for cap strategy without bid_amount', async () => {
    const campaign = makeDraftCampaign();
    campaign.data = { objective: 'OUTCOME_TRAFFIC', special_ad_categories: ['NONE'] };
    campaign.adSets[0].data.bid_strategy = 'COST_CAP';
    campaign.adSets[0].data.daily_budget = '3000';
    // No bid_amount set — should fall back to LOWEST_COST_WITHOUT_CAP
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    await DraftPublishService.publishCampaign('camp-1', 'token');
    const adSetCall = mockFbPost.mock.calls[1];
    expect(adSetCall[1].bid_strategy).toBe('LOWEST_COST_WITHOUT_CAP');
    expect(adSetCall[1]).not.toHaveProperty('bid_amount');
  });

  it('handles non-CBO adset with bid strategy that is not a cap strategy', async () => {
    const campaign = makeDraftCampaign();
    campaign.data = { objective: 'OUTCOME_TRAFFIC', special_ad_categories: ['NONE'] };
    campaign.adSets[0].data.bid_strategy = 'LOWEST_COST_WITHOUT_CAP';
    campaign.adSets[0].data.daily_budget = '3000';
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    await DraftPublishService.publishCampaign('camp-1', 'token');
    const adSetCall = mockFbPost.mock.calls[1];
    expect(adSetCall[1]).toHaveProperty('bid_strategy', 'LOWEST_COST_WITHOUT_CAP');
  });

  it('detectCBO returns false when is_adset_budget_sharing_enabled is false', async () => {
    const campaign = makeDraftCampaign();
    campaign.data.is_adset_budget_sharing_enabled = false;
    // No budget at campaign level = not CBO, needs is_adset_budget_sharing_enabled=false
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    await DraftPublishService.publishCampaign('camp-1', 'token');
    const campaignCall = mockFbPost.mock.calls[0];
    expect(campaignCall[1]).toHaveProperty('is_adset_budget_sharing_enabled', false);
  });

  it('handles CBO with is_adset_budget_sharing_enabled true', async () => {
    const campaign = makeDraftCampaign();
    campaign.data.is_adset_budget_sharing_enabled = true;
    campaign.data.daily_budget = '5000';
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    await DraftPublishService.publishCampaign('camp-1', 'token');
    const campaignCall = mockFbPost.mock.calls[0];
    expect(campaignCall[1]).toHaveProperty('daily_budget');
  });

  it('updateMetaCampaign with spend_cap', async () => {
    const campaign = makeDraftCampaign({ metaId: 'existing' });
    campaign.data.daily_budget = '5000';
    campaign.data.spend_cap = '50000';
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});
    mockCheckExistence.mockResolvedValue(true);

    mockFbPost
      .mockResolvedValueOnce({}) // campaign update
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    await DraftPublishService.publishCampaign('camp-1', 'token');
    const campaignCall = mockFbPost.mock.calls[0];
    expect(campaignCall[1]).toHaveProperty('spend_cap', '50000');
  });

  it('updateMetaCampaign with CBO and bid_strategy', async () => {
    const campaign = makeDraftCampaign({
      metaId: 'existing_camp',
      data: {
        objective: 'OUTCOME_TRAFFIC',
        special_ad_categories: ['NONE'],
        daily_budget: '10000',
        bid_strategy: 'COST_CAP',
        bid_amount: '500',
      },
    });
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});
    mockCheckExistence.mockResolvedValue(true);

    mockFbPost
      .mockResolvedValueOnce({}) // campaign update
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    const result = await DraftPublishService.publishCampaign('camp-1', 'token');
    expect(result.success).toBe(true);
    const campaignCall = mockFbPost.mock.calls[0];
    expect(campaignCall[1]).toHaveProperty('bid_strategy', 'COST_CAP');
    expect(campaignCall[1]).toHaveProperty('bid_amount', '500');
  });

  it('updateMetaCampaign with CBO lifetime_budget only', async () => {
    const campaign = makeDraftCampaign({
      metaId: 'existing_camp',
      data: {
        objective: 'OUTCOME_TRAFFIC',
        special_ad_categories: ['NONE'],
        lifetime_budget: '50000',
      },
    });
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});
    mockCheckExistence.mockResolvedValue(true);

    mockFbPost
      .mockResolvedValueOnce({}) // campaign update
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    const result = await DraftPublishService.publishCampaign('camp-1', 'token');
    expect(result.success).toBe(true);
    const campaignCall = mockFbPost.mock.calls[0];
    expect(campaignCall[1]).toHaveProperty('lifetime_budget', '50000');
  });

  it('updateMetaCampaign with CBO both budgets (prefers daily)', async () => {
    const campaign = makeDraftCampaign({
      metaId: 'existing_camp',
      data: {
        objective: 'OUTCOME_TRAFFIC',
        special_ad_categories: ['NONE'],
        daily_budget: '10000',
        lifetime_budget: '50000',
      },
    });
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});
    mockCheckExistence.mockResolvedValue(true);

    mockFbPost
      .mockResolvedValueOnce({}) // campaign update
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    const result = await DraftPublishService.publishCampaign('camp-1', 'token');
    expect(result.success).toBe(true);
    const campaignCall = mockFbPost.mock.calls[0];
    expect(campaignCall[1]).toHaveProperty('daily_budget', '10000');
    expect(campaignCall[1]).not.toHaveProperty('lifetime_budget');
  });

  it('updateMetaCampaign throws and stops publish on error', async () => {
    const campaign = makeDraftCampaign({ metaId: 'existing_camp' });
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAdSet.updateMany.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});
    mockPrisma.draftAd.updateMany.mockResolvedValue({});
    mockPrisma.draftPublishLog.create.mockResolvedValue({});
    mockCheckExistence.mockResolvedValue(true);

    mockFbPost
      .mockRejectedValueOnce({ response: { data: { error: { message: 'Rate limit' } } } }) // campaign update fails
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    await expect(DraftPublishService.publishCampaign('camp-1', 'token')).rejects.toThrow();
  });

  it('updateMetaAdSet throws and stops publish on error', async () => {
    const campaign = makeDraftCampaign();
    campaign.adSets[0].metaId = 'existing_adset';
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});
    mockCheckExistence.mockResolvedValue(true);

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockRejectedValueOnce({ response: { data: { error: { message: 'Update failed' } } } }) // adset update fails
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    await expect(DraftPublishService.publishCampaign('camp-1', 'token')).rejects.toBeDefined();
  });

  it('handles ad creation error with structured error response', async () => {
    const campaign = makeDraftCampaign();
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});
    mockPrisma.draftAdSet.updateMany.mockResolvedValue({});
    mockPrisma.draftAd.updateMany.mockResolvedValue({});
    mockPrisma.draftPublishLog.create.mockResolvedValue({});

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockRejectedValueOnce({
        response: { data: { error: { message: 'Creative invalid', code: 100, error_subcode: 1234, error_user_msg: 'Fix your creative' } } },
      });

    await expect(DraftPublishService.publishCampaign('camp-1', 'token'))
      .rejects.toThrow('Ad error');
  });

  it('throws on ad creation failure with plain error (no response)', async () => {
    const campaign = makeDraftCampaign();
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});
    mockPrisma.draftAdSet.updateMany.mockResolvedValue({});
    mockPrisma.draftAd.updateMany.mockResolvedValue({});
    mockPrisma.draftPublishLog.create.mockResolvedValue({});

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockRejectedValueOnce(new Error('Network timeout'));

    await expect(DraftPublishService.publishCampaign('camp-1', 'token'))
      .rejects.toThrow('Network timeout');
  });

  it('throws on adset creation failure with non-CBO subcode', async () => {
    const campaign = makeDraftCampaign();
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});
    mockPrisma.draftAdSet.updateMany.mockResolvedValue({});
    mockPrisma.draftAd.updateMany.mockResolvedValue({});
    mockPrisma.draftPublishLog.create.mockResolvedValue({});

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockRejectedValueOnce({
        response: { data: { error: { message: 'Invalid targeting', code: 100, error_subcode: 9999 } } },
      });

    await expect(DraftPublishService.publishCampaign('camp-1', 'token'))
      .rejects.toThrow('Ad Set error');
  });

  it('updateMetaAdSet includes non-CBO budget and bid fields', async () => {
    const campaign = makeDraftCampaign({
      data: {
        objective: 'OUTCOME_TRAFFIC',
        special_ad_categories: ['NONE'],
      },
    });
    campaign.adSets[0].metaId = 'existing_adset';
    campaign.adSets[0].data = {
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'LINK_CLICKS',
      targeting: { geo_locations: { countries: ['TH'] } },
      bid_strategy: 'COST_CAP',
      bid_amount: '500',
      daily_budget: '3000',
      start_time: '2026-01-01',
      end_time: '2026-12-31',
    };
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});
    mockCheckExistence.mockResolvedValue(true);

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({}) // adset update
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    const result = await DraftPublishService.publishCampaign('camp-1', 'token');
    expect(result.success).toBe(true);
    const adsetUpdateCall = mockFbPost.mock.calls[1];
    expect(adsetUpdateCall[1]).toHaveProperty('bid_strategy', 'COST_CAP');
    expect(adsetUpdateCall[1]).toHaveProperty('bid_amount', '500');
    expect(adsetUpdateCall[1]).toHaveProperty('daily_budget', '3000');
    expect(adsetUpdateCall[1]).toHaveProperty('start_time', '2026-01-01');
    expect(adsetUpdateCall[1]).toHaveProperty('end_time', '2026-12-31');
  });

  it('updateMetaAdSet with CBO skips budget/bid fields', async () => {
    const campaign = makeDraftCampaign({
      metaId: 'existing_camp',
      data: {
        objective: 'OUTCOME_TRAFFIC',
        special_ad_categories: ['NONE'],
        daily_budget: '10000',
      },
    });
    campaign.adSets[0].metaId = 'existing_adset';
    campaign.adSets[0].data = {
      optimization_goal: 'LINK_CLICKS',
      targeting: { geo_locations: { countries: ['TH'] } },
      bid_strategy: 'COST_CAP',
      bid_amount: '500',
      daily_budget: '3000',
    };
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});
    mockCheckExistence.mockResolvedValue(true);

    mockFbPost
      .mockResolvedValueOnce({}) // campaign update (CBO)
      .mockResolvedValueOnce({}) // adset update
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    const result = await DraftPublishService.publishCampaign('camp-1', 'token');
    expect(result.success).toBe(true);
    const adsetUpdateCall = mockFbPost.mock.calls[1];
    // CBO means no budget/bid fields in adset update
    expect(adsetUpdateCall[1]).not.toHaveProperty('bid_strategy');
    expect(adsetUpdateCall[1]).not.toHaveProperty('bid_amount');
    expect(adsetUpdateCall[1]).not.toHaveProperty('daily_budget');
  });

  it('updateMetaAdSet uses IMPRESSIONS fallback when billing_event missing', async () => {
    const campaign = makeDraftCampaign({
      data: {
        objective: 'OUTCOME_TRAFFIC',
        special_ad_categories: ['NONE'],
      },
    });
    campaign.adSets[0].metaId = 'existing_adset';
    campaign.adSets[0].data = {
      optimization_goal: 'LINK_CLICKS',
      targeting: { geo_locations: { countries: ['TH'] } },
    };
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});
    mockCheckExistence.mockResolvedValue(true);

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({}) // adset update
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    const result = await DraftPublishService.publishCampaign('camp-1', 'token');
    expect(result.success).toBe(true);
    const adsetUpdateCall = mockFbPost.mock.calls[1];
    expect(adsetUpdateCall[1]).toHaveProperty('billing_event', 'IMPRESSIONS');
  });

  it('updateMetaAdSet with lifetime_budget when no daily_budget', async () => {
    const campaign = makeDraftCampaign({
      data: {
        objective: 'OUTCOME_TRAFFIC',
        special_ad_categories: ['NONE'],
      },
    });
    campaign.adSets[0].metaId = 'existing_adset';
    campaign.adSets[0].data = {
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'LINK_CLICKS',
      targeting: { geo_locations: { countries: ['TH'] } },
      lifetime_budget: '50000',
      end_time: '2026-12-31T23:59:59+0000',
    };
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});
    mockCheckExistence.mockResolvedValue(true);

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({}) // adset update
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    const result = await DraftPublishService.publishCampaign('camp-1', 'token');
    expect(result.success).toBe(true);
    const adsetUpdateCall = mockFbPost.mock.calls[1];
    expect(adsetUpdateCall[1]).toHaveProperty('lifetime_budget', '50000');
    expect(adsetUpdateCall[1]).not.toHaveProperty('daily_budget');
  });

  it('includes attribution_spec in updateMetaAdSet for supported objectives', async () => {
    const campaign = makeDraftCampaign({
      objective: 'OUTCOME_SALES',
      data: {
        objective: 'OUTCOME_SALES',
        special_ad_categories: ['NONE'],
      },
    });
    campaign.adSets[0].metaId = 'existing_adset';
    campaign.adSets[0].data = {
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'OFFSITE_CONVERSIONS',
      targeting: { geo_locations: { countries: ['TH'] } },
      attribution_spec: [{ event_type: 'CLICK_THROUGH', window_days: 7 }],
      promoted_object: { pixel_id: '123' },
    };
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});
    mockCheckExistence.mockResolvedValue(true);

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({}) // adset update
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    const result = await DraftPublishService.publishCampaign('camp-1', 'token');
    expect(result.success).toBe(true);
    // The second post call (adset update) should include attribution_spec
    const adsetUpdateCall = mockFbPost.mock.calls[1];
    expect(adsetUpdateCall[1]).toHaveProperty('attribution_spec');
  });

  it('throws when promoted_object has wrong fields in createMetaAdSet (bypassing validation)', async () => {
    const campaign = makeDraftCampaign({
      objective: 'OUTCOME_SALES',
      data: {
        objective: 'OUTCOME_SALES',
        special_ad_categories: ['NONE'],
      },
    });
    campaign.adSets[0].data = {
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'OFFSITE_CONVERSIONS',
      targeting: { geo_locations: { countries: ['TH'] } },
      promoted_object: { invalid_field: 'x' },
    };
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAdSet.updateMany.mockResolvedValue({});
    mockPrisma.draftAd.updateMany.mockResolvedValue({});
    mockPrisma.draftPublishLog.create.mockResolvedValue({});

    mockFbPost.mockResolvedValueOnce({ data: { id: 'meta_camp_1' } });

    await expect(DraftPublishService.publishCampaign('camp-1', 'token'))
      .rejects.toThrow('promoted_object must include');
  });

  it('creates adset with both daily and lifetime budget (daily preferred)', async () => {
    const campaign = makeDraftCampaign();
    campaign.adSets[0].data = {
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'LINK_CLICKS',
      targeting: { geo_locations: { countries: ['TH'] } },
      daily_budget: '5000',
      lifetime_budget: '50000',
    };
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    const result = await DraftPublishService.publishCampaign('camp-1', 'token');
    expect(result.success).toBe(true);
    // The adset creation call should have daily_budget only (daily wins when both present)
    const adsetCall = mockFbPost.mock.calls[1];
    expect(adsetCall[1]).toHaveProperty('daily_budget', '5000');
    expect(adsetCall[1]).not.toHaveProperty('lifetime_budget');
  });

  it('throws when ad is missing creative_id (bypassing validation)', async () => {
    const campaign = makeDraftCampaign();
    campaign.adSets[0].ads[0].data = { creative: {} };
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});
    mockPrisma.draftAdSet.updateMany.mockResolvedValue({});
    mockPrisma.draftAd.updateMany.mockResolvedValue({});
    mockPrisma.draftPublishLog.create.mockResolvedValue({});

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({ data: { id: 'meta_adset_1' } });

    await expect(DraftPublishService.publishCampaign('camp-1', 'token'))
      .rejects.toThrow('missing creative_id');
  });

  it('strips immutable fields from adset update and warns', async () => {
    const campaign = makeDraftCampaign();
    campaign.adSets[0].metaId = 'existing_adset';
    campaign.adSets[0].data = {
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'LINK_CLICKS',
      targeting: { geo_locations: { countries: ['TH'] } },
      destination_type: 'WEBSITE',
    };
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});
    mockCheckExistence.mockResolvedValue(true);

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockFbPost
      .mockResolvedValueOnce({ data: { id: 'meta_camp_1' } })
      .mockResolvedValueOnce({}) // adset update
      .mockResolvedValueOnce({ data: { id: 'meta_ad_1' } });

    const result = await DraftPublishService.publishCampaign('camp-1', 'token');
    expect(result.success).toBe(true);
    consoleSpy.mockRestore();
  });
});

describe('DraftPublishService.cleanupOrphanedMetaObjects', () => {
  it('deletes all meta objects and resets status', async () => {
    const campaign = {
      id: 'camp-1',
      metaId: 'meta_camp_1',
      adSets: [{
        id: 'adset-1',
        metaId: 'meta_adset_1',
        ads: [{ id: 'ad-1', metaId: 'meta_ad_1' }],
      }],
    };
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});
    mockFbPost.mockResolvedValue({});

    const result = await DraftPublishService.cleanupOrphanedMetaObjects('camp-1', 'token');
    expect(result.deleted).toContain('ad:meta_ad_1');
    expect(result.deleted).toContain('adset:meta_adset_1');
    expect(result.deleted).toContain('campaign:meta_camp_1');
  });

  it('throws if draft not found', async () => {
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(null);
    await expect(DraftPublishService.cleanupOrphanedMetaObjects('camp-1', 'token'))
      .rejects.toThrow('Draft not found');
  });

  it('handles already deleted meta objects gracefully (no crash)', async () => {
    const campaign = {
      id: 'camp-1',
      metaId: 'meta_camp_1',
      adSets: [{
        id: 'adset-1',
        metaId: 'meta_adset_1',
        ads: [{ id: 'ad-1', metaId: 'meta_ad_1' }],
      }],
    };
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});
    mockFbPost.mockRejectedValue(new Error('Object does not exist'));

    const result = await DraftPublishService.cleanupOrphanedMetaObjects('camp-1', 'token');
    // The errors are caught silently, so deleted array is empty (push is inside try)
    expect(result.deleted).toHaveLength(0);
    // But the prisma updates still happen to reset metaId/status
    expect(mockPrisma.draftAd.update).toHaveBeenCalled();
    expect(mockPrisma.draftAdSet.update).toHaveBeenCalled();
    expect(mockPrisma.draftCampaign.update).toHaveBeenCalled();
  });

  it('skips deletion for entities without metaId', async () => {
    const campaign = {
      id: 'camp-1',
      metaId: null,
      adSets: [{
        id: 'adset-1',
        metaId: null,
        ads: [{ id: 'ad-1', metaId: null }],
      }],
    };
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);

    const result = await DraftPublishService.cleanupOrphanedMetaObjects('camp-1', 'token');
    expect(result.deleted).toHaveLength(0);
    expect(mockFbPost).not.toHaveBeenCalled();
    expect(mockPrisma.draftAd.update).not.toHaveBeenCalled();
    expect(mockPrisma.draftAdSet.update).not.toHaveBeenCalled();
    expect(mockPrisma.draftCampaign.update).not.toHaveBeenCalled();
  });

  it('handles mixed entities — some with metaId, some without', async () => {
    const campaign = {
      id: 'camp-1',
      metaId: 'meta_camp_1',
      adSets: [{
        id: 'adset-1',
        metaId: null,
        ads: [
          { id: 'ad-1', metaId: 'meta_ad_1' },
          { id: 'ad-2', metaId: null },
        ],
      }],
    };
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAd.update.mockResolvedValue({});
    mockFbPost.mockResolvedValue({});

    const result = await DraftPublishService.cleanupOrphanedMetaObjects('camp-1', 'token');
    expect(result.deleted).toContain('ad:meta_ad_1');
    expect(result.deleted).toContain('campaign:meta_camp_1');
    expect(result.deleted).not.toContain('adset:null');
    // ad-1 has metaId -> update called, ad-2 has no metaId -> skipped
    expect(mockPrisma.draftAd.update).toHaveBeenCalledTimes(1);
    // adset has no metaId -> no adset update
    expect(mockPrisma.draftAdSet.update).not.toHaveBeenCalled();
  });
});
