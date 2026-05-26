import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DraftStatus } from '@prisma/client';

vi.mock('../../src/prisma', () => ({
  prisma: {
    draftAd: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    draftAdSet: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    draftCampaign: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from '../../src/prisma';
import { DraftAdService } from '../../src/services/draft/DraftAdService';
import { DraftAdSetService } from '../../src/services/draft/DraftAdSetService';
import { DraftCampaignService } from '../../src/services/draft/DraftCampaignService';

const mockPrisma = prisma as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DraftAdService', () => {
  it('creates an ad with correct data', async () => {
    const expected = { id: 'ad-1', name: 'Test Ad', status: DraftStatus.DRAFT };
    mockPrisma.draftAd.create.mockResolvedValue(expected);

    const result = await DraftAdService.create('user-1', 'act_123', 'adset-1', 'Test Ad', { creative: {} });
    expect(mockPrisma.draftAd.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        adAccountId: 'act_123',
        draftAdSetId: 'adset-1',
        name: 'Test Ad',
        data: { creative: {} },
        status: DraftStatus.DRAFT,
      },
    });
    expect(result).toEqual(expected);
  });

  it('getById includes adSet and campaign', async () => {
    const expected = { id: 'ad-1', adSet: { id: 'adset-1', campaign: { id: 'camp-1' } } };
    mockPrisma.draftAd.findUnique.mockResolvedValue(expected);

    const result = await DraftAdService.getById('ad-1');
    expect(mockPrisma.draftAd.findUnique).toHaveBeenCalledWith({
      where: { id: 'ad-1' },
      include: { adSet: { include: { campaign: true } } },
    });
    expect(result).toEqual(expected);
  });

  it('update strips internal fields', async () => {
    const expected = { id: 'ad-1', name: 'Updated' };
    mockPrisma.draftAd.update.mockResolvedValue(expected);

    await DraftAdService.update('ad-1', {
      id: 'ad-1',
      adSet: {},
      user: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: 'user-1',
      draftAdSetId: 'adset-1',
      _count: {},
      name: 'Updated',
      data: { creative: { creative_id: '456' } },
    });
    expect(mockPrisma.draftAd.update).toHaveBeenCalledWith({
      where: { id: 'ad-1' },
      data: { name: 'Updated', data: { creative: { creative_id: '456' } } },
    });
  });

  it('deletes an ad', async () => {
    mockPrisma.draftAd.delete.mockResolvedValue({ id: 'ad-1' });
    await DraftAdService.delete('ad-1');
    expect(mockPrisma.draftAd.delete).toHaveBeenCalledWith({ where: { id: 'ad-1' } });
  });
});

describe('DraftAdSetService', () => {
  it('creates an ad set with correct data', async () => {
    const expected = { id: 'adset-1', name: 'Test AdSet', status: DraftStatus.DRAFT };
    mockPrisma.draftAdSet.create.mockResolvedValue(expected);

    const result = await DraftAdSetService.create('user-1', 'act_123', 'camp-1', 'Test AdSet', { billing_event: 'IMPRESSIONS' });
    expect(mockPrisma.draftAdSet.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        adAccountId: 'act_123',
        draftCampaignId: 'camp-1',
        name: 'Test AdSet',
        data: { billing_event: 'IMPRESSIONS' },
        status: DraftStatus.DRAFT,
      },
    });
    expect(result).toEqual(expected);
  });

  it('getById includes ads and campaign', async () => {
    mockPrisma.draftAdSet.findUnique.mockResolvedValue({ id: 'adset-1' });
    await DraftAdSetService.getById('adset-1');
    expect(mockPrisma.draftAdSet.findUnique).toHaveBeenCalledWith({
      where: { id: 'adset-1' },
      include: { ads: true, campaign: true },
    });
  });

  it('update strips internal fields', async () => {
    mockPrisma.draftAdSet.update.mockResolvedValue({ id: 'adset-1' });

    await DraftAdSetService.update('adset-1', {
      id: 'adset-1',
      ads: [],
      campaign: {},
      user: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: 'user-1',
      draftCampaignId: 'camp-1',
      _count: {},
      name: 'Updated AdSet',
    });
    expect(mockPrisma.draftAdSet.update).toHaveBeenCalledWith({
      where: { id: 'adset-1' },
      data: { name: 'Updated AdSet' },
    });
  });

  it('deletes an ad set', async () => {
    mockPrisma.draftAdSet.delete.mockResolvedValue({ id: 'adset-1' });
    await DraftAdSetService.delete('adset-1');
    expect(mockPrisma.draftAdSet.delete).toHaveBeenCalledWith({ where: { id: 'adset-1' } });
  });
});

describe('DraftCampaignService', () => {
  it('creates a campaign', async () => {
    const expected = { id: 'camp-1', name: 'Test', objective: 'OUTCOME_TRAFFIC' };
    mockPrisma.draftCampaign.create.mockResolvedValue(expected);

    const result = await DraftCampaignService.create('user-1', 'act_123', 'Test', 'OUTCOME_TRAFFIC', {});
    expect(mockPrisma.draftCampaign.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        adAccountId: 'act_123',
        name: 'Test',
        objective: 'OUTCOME_TRAFFIC',
        data: {},
        status: DraftStatus.DRAFT,
      },
    });
    expect(result).toEqual(expected);
  });

  it('getById includes adSets with ads', async () => {
    mockPrisma.draftCampaign.findUnique.mockResolvedValue({ id: 'camp-1' });
    await DraftCampaignService.getById('camp-1');
    expect(mockPrisma.draftCampaign.findUnique).toHaveBeenCalledWith({
      where: { id: 'camp-1' },
      include: { adSets: { include: { ads: true } } },
    });
  });

  it('listByUser returns campaigns ordered by createdAt desc with pagination', async () => {
    mockPrisma.draftCampaign.findMany.mockResolvedValue([]);
    mockPrisma.draftCampaign.count.mockResolvedValue(0);
    const result = await DraftCampaignService.listByUser('user-1');
    expect(mockPrisma.draftCampaign.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 50,
      include: { _count: { select: { adSets: true } } },
    });
    expect(result.total).toBe(0);
    expect(result.page).toBe(1);
  });

  it('update strips internal fields', async () => {
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(null);
    mockPrisma.draftCampaign.update.mockResolvedValue({ id: 'camp-1' });

    await DraftCampaignService.update('camp-1', {
      id: 'camp-1',
      adSets: [],
      user: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: 'user-1',
      _count: {},
      name: 'Updated',
      data: { objective: 'OUTCOME_TRAFFIC', bid_strategy: 'COST_CAP' },
    });
    expect(mockPrisma.draftCampaign.update).toHaveBeenCalledWith({
      where: { id: 'camp-1' },
      data: { name: 'Updated', data: { objective: 'OUTCOME_TRAFFIC', bid_strategy: 'COST_CAP' } },
    });
  });

  it('update warns about immutable fields on published draft', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockPrisma.draftCampaign.findUnique.mockResolvedValue({
      id: 'camp-1',
      metaId: 'meta_123',
      data: { buying_type: 'AUCTION', objective: 'OUTCOME_TRAFFIC' },
    });
    mockPrisma.draftCampaign.update.mockResolvedValue({ id: 'camp-1' });

    await DraftCampaignService.update('camp-1', {
      name: 'Updated',
      data: { buying_type: 'RESERVED', objective: 'OUTCOME_TRAFFIC' },
    });
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Immutable field edit'),
      expect.arrayContaining([expect.stringContaining('buying_type')])
    );
    consoleSpy.mockRestore();
  });

  it('update does not warn when no metaId', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockPrisma.draftCampaign.findUnique.mockResolvedValue({
      id: 'camp-1',
      metaId: null,
      data: { buying_type: 'AUCTION' },
    });
    mockPrisma.draftCampaign.update.mockResolvedValue({ id: 'camp-1' });

    await DraftCampaignService.update('camp-1', {
      data: { buying_type: 'RESERVED' },
    });
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('update without data field skips immutable check', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockPrisma.draftCampaign.update.mockResolvedValue({ id: 'camp-1' });

    await DraftCampaignService.update('camp-1', {
      name: 'Just a name update',
    });
    expect(mockPrisma.draftCampaign.findUnique).not.toHaveBeenCalled();
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('update with data but existing not found proceeds normally', async () => {
    mockPrisma.draftCampaign.findUnique.mockResolvedValue(null);
    mockPrisma.draftCampaign.update.mockResolvedValue({ id: 'camp-1' });

    await DraftCampaignService.update('camp-1', {
      data: { buying_type: 'RESERVED' },
    });
    expect(mockPrisma.draftCampaign.update).toHaveBeenCalled();
  });

  it('update with data where values match existing (no warning)', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockPrisma.draftCampaign.findUnique.mockResolvedValue({
      id: 'camp-1',
      metaId: 'meta_123',
      data: { buying_type: 'AUCTION', objective: 'OUTCOME_TRAFFIC' },
    });
    mockPrisma.draftCampaign.update.mockResolvedValue({ id: 'camp-1' });

    await DraftCampaignService.update('camp-1', {
      data: { buying_type: 'AUCTION', objective: 'OUTCOME_TRAFFIC' },
    });
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('deletes a campaign', async () => {
    mockPrisma.draftCampaign.delete.mockResolvedValue({ id: 'camp-1' });
    await DraftCampaignService.delete('camp-1');
    expect(mockPrisma.draftCampaign.delete).toHaveBeenCalledWith({ where: { id: 'camp-1' } });
  });
});
