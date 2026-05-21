import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DraftStatus } from '@prisma/client';

vi.mock('../../src/prisma', () => {
  const prismaMock: any = {
    draftCampaign: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    draftAdSet: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    draftAd: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
  // generateFromTemplate wraps writes in $transaction — pass the same mock as tx.
  prismaMock.$transaction = vi.fn((cb: any) => cb(prismaMock));
  return { prisma: prismaMock };
});

import { prisma } from '../../src/prisma';
import { WideCreationService, WideCreationTemplate } from '../../src/services/draft/WideCreationService';

const mockPrisma = prisma as any;

let idCounter = 0;
beforeEach(() => {
  vi.clearAllMocks();
  idCounter = 0;
  mockPrisma.draftCampaign.create.mockImplementation(() =>
    Promise.resolve({ id: `camp-${++idCounter}` })
  );
  mockPrisma.draftAdSet.create.mockImplementation(() =>
    Promise.resolve({ id: `adset-${++idCounter}` })
  );
  mockPrisma.draftAd.create.mockImplementation(() =>
    Promise.resolve({ id: `ad-${++idCounter}` })
  );
});

describe('WideCreationService.generateFromTemplate', () => {
  it('generates a simple campaign with 1 adset and 1 ad', async () => {
    const template: WideCreationTemplate = {
      name: 'Simple Template',
      adAccountId: 'act_123456',
      campaigns: [{
        fields: { objective: 'OUTCOME_TRAFFIC', name: 'Campaign 1' },
        adSetCount: 1,
      }],
    };

    const result = await WideCreationService.generateFromTemplate(template, 'user-1');
    expect(result.totalCreated.campaigns).toBe(1);
    expect(result.totalCreated.adSets).toBe(1);
    expect(result.totalCreated.ads).toBe(1);
    expect(mockPrisma.draftCampaign.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.draftAdSet.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.draftAd.create).toHaveBeenCalledTimes(1);
  });

  it('uses naming patterns', async () => {
    const template: WideCreationTemplate = {
      name: 'Named Template',
      adAccountId: 'act_123',
      namingPattern: {
        campaign: '{objective} Campaign {index:02d}',
        adSet: '{parent} - AdSet {n}',
        ad: 'Ad {index:03d} of {total}',
      },
      campaigns: [{
        fields: { objective: 'OUTCOME_SALES' },
        adSetCount: 2,
        adSets: [
          { fields: {}, adCount: 2 },
          { fields: {}, adCount: 1 },
        ],
      }],
    };

    await WideCreationService.generateFromTemplate(template, 'user-1');

    const campaignCall = mockPrisma.draftCampaign.create.mock.calls[0][0].data;
    expect(campaignCall.name).toBe('OUTCOME_SALES Campaign 01');

    const adSetCall1 = mockPrisma.draftAdSet.create.mock.calls[0][0].data;
    expect(adSetCall1.name).toBe('OUTCOME_SALES Campaign 01 - AdSet 1');

    const adCall1 = mockPrisma.draftAd.create.mock.calls[0][0].data;
    expect(adCall1.name).toBe('Ad 001 of 2');
  });

  it('normalizes adAccountId without act_ prefix', async () => {
    const template: WideCreationTemplate = {
      name: 'Test',
      adAccountId: '123456',
      campaigns: [{
        fields: { objective: 'OUTCOME_TRAFFIC', name: 'C1' },
        adSetCount: 1,
      }],
    };

    await WideCreationService.generateFromTemplate(template, 'user-1');
    expect(mockPrisma.draftCampaign.create.mock.calls[0][0].data.adAccountId).toBe('act_123456');
  });

  it('applies template defaults for campaign', async () => {
    const template: WideCreationTemplate = {
      name: 'Defaults',
      adAccountId: 'act_123',
      defaults: {
        campaign: {
          bid_strategy: 'COST_CAP',
          daily_budget: '5000',
          special_ad_categories: ['HOUSING'],
        },
      },
      campaigns: [{
        fields: { objective: 'OUTCOME_TRAFFIC', name: 'C1' },
        adSetCount: 1,
      }],
    };

    await WideCreationService.generateFromTemplate(template, 'user-1');
    const data = mockPrisma.draftCampaign.create.mock.calls[0][0].data.data;
    expect(data.bid_strategy).toBe('COST_CAP');
    expect(data.daily_budget).toBe('5000');
    expect(data.special_ad_categories).toContain('HOUSING');
  });

  it('applies template defaults for adSet', async () => {
    const template: WideCreationTemplate = {
      name: 'AdSet Defaults',
      adAccountId: 'act_123',
      defaults: {
        adSet: {
          billing_event: 'LINK_CLICKS',
          daily_budget: '3000',
        },
      },
      campaigns: [{
        fields: { objective: 'OUTCOME_TRAFFIC', name: 'C1' },
        adSetCount: 1,
      }],
    };

    await WideCreationService.generateFromTemplate(template, 'user-1');
    const data = mockPrisma.draftAdSet.create.mock.calls[0][0].data.data;
    expect(data.billing_event).toBe('LINK_CLICKS');
    expect(data.daily_budget).toBe('3000');
  });

  it('applies template defaults for ad (creative)', async () => {
    const template: WideCreationTemplate = {
      name: 'Ad Defaults',
      adAccountId: 'act_123',
      defaults: {
        ad: {
          creative: { creative_id: '999' },
          tracking_specs: [{ 'action.type': ['offsite_conversion'] }],
        },
      },
      campaigns: [{
        fields: { objective: 'OUTCOME_TRAFFIC', name: 'C1' },
        adSetCount: 1,
      }],
    };

    await WideCreationService.generateFromTemplate(template, 'user-1');
    const data = mockPrisma.draftAd.create.mock.calls[0][0].data.data;
    expect(data.creative).toEqual({ creative_id: '999' });
    expect(data.tracking_specs).toBeDefined();
  });

  it('skips adset budget fields under CBO', async () => {
    const template: WideCreationTemplate = {
      name: 'CBO',
      adAccountId: 'act_123',
      campaigns: [{
        fields: { objective: 'OUTCOME_TRAFFIC', name: 'C1', daily_budget: '10000' },
        adSetCount: 1,
        adSets: [{
          fields: { daily_budget: '3000' },
          adCount: 1,
          ads: [],
        }],
      }],
    };

    await WideCreationService.generateFromTemplate(template, 'user-1');
    const adSetData = mockPrisma.draftAdSet.create.mock.calls[0][0].data.data;
    expect(adSetData.daily_budget).toBeUndefined();
  });

  it('includes adset budget for non-CBO', async () => {
    const template: WideCreationTemplate = {
      name: 'Non-CBO',
      adAccountId: 'act_123',
      campaigns: [{
        fields: { objective: 'OUTCOME_TRAFFIC', name: 'C1' },
        adSetCount: 1,
        adSets: [{
          fields: { daily_budget: '3000' },
          adCount: 1,
          ads: [],
        }],
      }],
    };

    await WideCreationService.generateFromTemplate(template, 'user-1');
    const adSetData = mockPrisma.draftAdSet.create.mock.calls[0][0].data.data;
    expect(adSetData.daily_budget).toBe('3000');
  });

  it('warns when promoted_object missing for OUTCOME_LEADS', async () => {
    const template: WideCreationTemplate = {
      name: 'Leads',
      adAccountId: 'act_123',
      campaigns: [{
        fields: { objective: 'OUTCOME_LEADS', name: 'C1' },
        adSetCount: 1,
      }],
    };

    const result = await WideCreationService.generateFromTemplate(template, 'user-1');
    expect(result.warnings.some(w => w.includes('promoted_object'))).toBe(true);
  });

  it('includes promoted_object when provided', async () => {
    const template: WideCreationTemplate = {
      name: 'Leads with PO',
      adAccountId: 'act_123',
      campaigns: [{
        fields: { objective: 'OUTCOME_LEADS', name: 'C1' },
        adSetCount: 1,
        adSets: [{
          fields: { promoted_object: { page_id: '12345' } },
          adCount: 1,
          ads: [],
        }],
      }],
    };

    await WideCreationService.generateFromTemplate(template, 'user-1');
    const adSetData = mockPrisma.draftAdSet.create.mock.calls[0][0].data.data;
    expect(adSetData.promoted_object).toEqual({ page_id: '12345' });
  });

  it('includes attribution_spec for supported objectives', async () => {
    const template: WideCreationTemplate = {
      name: 'Sales',
      adAccountId: 'act_123',
      campaigns: [{
        fields: { objective: 'OUTCOME_SALES', name: 'C1' },
        adSetCount: 1,
        adSets: [{
          fields: {
            attribution_spec: [{ event_type: 'CLICK_THROUGH', window_days: 7 }],
            promoted_object: { pixel_id: '123' },
          },
          adCount: 1,
          ads: [],
        }],
      }],
    };

    await WideCreationService.generateFromTemplate(template, 'user-1');
    const adSetData = mockPrisma.draftAdSet.create.mock.calls[0][0].data.data;
    expect(adSetData.attribution_spec).toBeDefined();
  });

  it('generates multiple campaigns', async () => {
    const template: WideCreationTemplate = {
      name: 'Multi',
      adAccountId: 'act_123',
      campaigns: [
        { fields: { objective: 'OUTCOME_TRAFFIC', name: 'C1' }, adSetCount: 1 },
        { fields: { objective: 'OUTCOME_SALES', name: 'C2' }, adSetCount: 2 },
      ],
    };

    const result = await WideCreationService.generateFromTemplate(template, 'user-1');
    expect(result.totalCreated.campaigns).toBe(2);
    expect(result.totalCreated.adSets).toBe(3);
  });

  it('uses explicit adSets array over adSetCount', async () => {
    const template: WideCreationTemplate = {
      name: 'Explicit',
      adAccountId: 'act_123',
      campaigns: [{
        fields: { objective: 'OUTCOME_TRAFFIC', name: 'C1' },
        adSetCount: 5,
        adSets: [
          { fields: { billing_event: 'LINK_CLICKS' }, adCount: 2 },
          { fields: { billing_event: 'IMPRESSIONS' }, adCount: 1 },
        ],
      }],
    };

    const result = await WideCreationService.generateFromTemplate(template, 'user-1');
    expect(result.totalCreated.adSets).toBe(2);
    expect(result.totalCreated.ads).toBe(3);
  });

  it('includes start_time and end_time', async () => {
    const template: WideCreationTemplate = {
      name: 'Timed',
      adAccountId: 'act_123',
      campaigns: [{
        fields: { objective: 'OUTCOME_TRAFFIC', name: 'C1' },
        adSetCount: 1,
        adSets: [{
          fields: { start_time: '2026-06-01', end_time: '2026-12-31' },
          adCount: 1,
          ads: [],
        }],
      }],
    };

    await WideCreationService.generateFromTemplate(template, 'user-1');
    const adSetData = mockPrisma.draftAdSet.create.mock.calls[0][0].data.data;
    expect(adSetData.start_time).toBe('2026-06-01');
    expect(adSetData.end_time).toBe('2026-12-31');
  });

  it('falls back to OUTCOME_TRAFFIC when no objective', async () => {
    const template: WideCreationTemplate = {
      name: 'No Objective',
      adAccountId: 'act_123',
      campaigns: [{
        fields: { name: 'C1' },
        adSetCount: 1,
      }],
    };

    await WideCreationService.generateFromTemplate(template, 'user-1');
    const campaignData = mockPrisma.draftCampaign.create.mock.calls[0][0].data;
    expect(campaignData.objective).toBe('OUTCOME_TRAFFIC');
  });

  it('uses campaign lifetime_budget when daily_budget is not set', async () => {
    const template: WideCreationTemplate = {
      name: 'Lifetime Budget',
      adAccountId: 'act_123',
      campaigns: [{
        fields: { objective: 'OUTCOME_TRAFFIC', name: 'C1', lifetime_budget: '100000' },
        adSetCount: 1,
      }],
    };

    await WideCreationService.generateFromTemplate(template, 'user-1');
    const data = mockPrisma.draftCampaign.create.mock.calls[0][0].data.data;
    expect(data.lifetime_budget).toBe('100000');
    expect(data.daily_budget).toBeUndefined();
  });

  it('uses adset lifetime_budget when daily_budget is not set (non-CBO)', async () => {
    const template: WideCreationTemplate = {
      name: 'AdSet Lifetime',
      adAccountId: 'act_123',
      campaigns: [{
        fields: { objective: 'OUTCOME_TRAFFIC', name: 'C1' },
        adSetCount: 1,
        adSets: [{
          fields: { lifetime_budget: '50000' },
          adCount: 1,
          ads: [],
        }],
      }],
    };

    await WideCreationService.generateFromTemplate(template, 'user-1');
    const adSetData = mockPrisma.draftAdSet.create.mock.calls[0][0].data.data;
    expect(adSetData.lifetime_budget).toBe('50000');
    expect(adSetData.daily_budget).toBeUndefined();
  });
});

describe('WideCreationService.bulkApplyFields', () => {
  it('updates campaign fields', async () => {
    mockPrisma.draftCampaign.findUnique.mockResolvedValue({
      id: 'camp-1',
      name: 'Original',
      objective: 'OUTCOME_TRAFFIC',
      data: { objective: 'OUTCOME_TRAFFIC', bid_strategy: 'LOWEST_COST_WITHOUT_CAP' },
    });
    mockPrisma.draftCampaign.update.mockResolvedValue({});

    const result = await WideCreationService.bulkApplyFields(
      ['camp-1'],
      'campaign',
      { bid_strategy: 'COST_CAP', name: 'Updated' }
    );
    expect(result.updated).toBe(1);
    expect(mockPrisma.draftCampaign.update).toHaveBeenCalledWith({
      where: { id: 'camp-1' },
      data: expect.objectContaining({ name: 'Updated' }),
    });
  });

  it('updates adSet fields', async () => {
    mockPrisma.draftAdSet.findUnique.mockResolvedValue({
      id: 'adset-1',
      name: 'Original',
      data: { billing_event: 'IMPRESSIONS' },
    });
    mockPrisma.draftAdSet.update.mockResolvedValue({});

    const result = await WideCreationService.bulkApplyFields(
      ['adset-1'],
      'adSet',
      { daily_budget: '5000' }
    );
    expect(result.updated).toBe(1);
  });

  it('updates ad fields', async () => {
    mockPrisma.draftAd.findUnique.mockResolvedValue({
      id: 'ad-1',
      name: 'Original',
      data: { creative: { creative_id: '111' } },
    });
    mockPrisma.draftAd.update.mockResolvedValue({});

    const result = await WideCreationService.bulkApplyFields(
      ['ad-1'],
      'ad',
      { creative: { creative_id: '222' } }
    );
    expect(result.updated).toBe(1);
  });

  it('skips non-existent entities', async () => {
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(null);
    const result = await WideCreationService.bulkApplyFields(['non-exist'], 'campaign', { name: 'X' });
    expect(result.updated).toBe(0);
  });

  it('cascades to children when cascadeToChildren=true', async () => {
    mockPrisma.draftCampaign.findUnique.mockResolvedValue({
      id: 'camp-1',
      name: 'Camp',
      objective: 'OUTCOME_TRAFFIC',
      data: {},
    });
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.findMany.mockResolvedValue([
      { id: 'adset-1', data: { billing_event: 'IMPRESSIONS' } },
      { id: 'adset-2', data: { billing_event: 'IMPRESSIONS' } },
    ]);
    mockPrisma.draftAdSet.update.mockResolvedValue({});

    const result = await WideCreationService.bulkApplyFields(
      ['camp-1'],
      'campaign',
      { targeting: { geo_locations: { countries: ['US'] } } },
      true
    );
    expect(result.updated).toBe(1);
    expect(result.cascaded).toBe(2);
    expect(mockPrisma.draftAdSet.update).toHaveBeenCalledTimes(2);
  });

  it('does not cascade non-inheritable fields', async () => {
    mockPrisma.draftCampaign.findUnique.mockResolvedValue({
      id: 'camp-1',
      name: 'Camp',
      objective: 'OUTCOME_TRAFFIC',
      data: {},
    });
    mockPrisma.draftCampaign.update.mockResolvedValue({});
    mockPrisma.draftAdSet.findMany.mockResolvedValue([
      { id: 'adset-1', data: {} },
    ]);

    const result = await WideCreationService.bulkApplyFields(
      ['camp-1'],
      'campaign',
      { bid_strategy: 'COST_CAP' },
      true
    );
    expect(result.cascaded).toBe(0);
  });

  it('updates multiple entities', async () => {
    mockPrisma.draftAdSet.findUnique
      .mockResolvedValueOnce({ id: 'adset-1', name: 'AS1', data: {} })
      .mockResolvedValueOnce({ id: 'adset-2', name: 'AS2', data: {} });
    mockPrisma.draftAdSet.update.mockResolvedValue({});

    const result = await WideCreationService.bulkApplyFields(
      ['adset-1', 'adset-2'],
      'adSet',
      { daily_budget: '5000' }
    );
    expect(result.updated).toBe(2);
  });
});

describe('WideCreationService.getTreeStructure', () => {
  it('returns campaign tree from prisma', async () => {
    const mockTree = [
      { id: 'camp-1', adSets: [{ id: 'adset-1', ads: [{ id: 'ad-1' }] }] },
    ];
    mockPrisma.draftCampaign.findMany.mockResolvedValue(mockTree);

    const result = await WideCreationService.getTreeStructure(['camp-1']);
    expect(result).toEqual(mockTree);
    expect(mockPrisma.draftCampaign.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['camp-1'] } },
      include: {
        adSets: { include: { ads: true }, orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'asc' },
    });
  });
});
