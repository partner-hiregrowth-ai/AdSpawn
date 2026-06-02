import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/prisma', () => ({
  prisma: {
    profile: { findFirst: vi.fn() },
    draftCampaign: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    draftAdSet: { findFirst: vi.fn(), update: vi.fn() },
    draftAd: { findFirst: vi.fn(), update: vi.fn() },
    draftShare: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    duplicateJob: { create: vi.fn() },
  },
}));

vi.mock('../../src/config', () => ({
  config: { jwtSecret: 'test-secret' },
}));

import { prisma } from '../../src/prisma';
import { DraftCampaignService } from '../../src/services/draft/DraftCampaignService';
import { DraftAdSetService } from '../../src/services/draft/DraftAdSetService';
import { DraftAdService } from '../../src/services/draft/DraftAdService';

const mockPrisma = prisma as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DraftCampaignService ownership enforcement', () => {
  it('getById with profileId uses findFirst with ownership filter', async () => {
    mockPrisma.draftCampaign.findFirst.mockResolvedValue(null);

    const result = await DraftCampaignService.getById('camp-1', 'profile-1');

    expect(mockPrisma.draftCampaign.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'camp-1',
        OR: [
          { profileId: 'profile-1' },
          { shares: { some: { sharedWithProfileId: 'profile-1' } } },
        ],
      },
      include: { adSets: { include: { ads: true } } },
    });
    expect(result).toBeNull();
  });

  it('getById without profileId uses findUnique (no ownership filter)', async () => {
    mockPrisma.draftCampaign.findUnique.mockResolvedValue({ id: 'camp-1' });

    await DraftCampaignService.getById('camp-1');

    expect(mockPrisma.draftCampaign.findUnique).toHaveBeenCalledWith({
      where: { id: 'camp-1' },
      include: { adSets: { include: { ads: true } } },
    });
    expect(mockPrisma.draftCampaign.findFirst).not.toHaveBeenCalled();
  });

  it('update with profileId throws notFound when ownership fails', async () => {
    mockPrisma.draftCampaign.findFirst.mockResolvedValue(null);

    await expect(
      DraftCampaignService.update('camp-1', { name: 'New Name' }, 'wrong-profile')
    ).rejects.toMatchObject({ notFound: true });
  });

  it('update with profileId succeeds when ownership matches', async () => {
    mockPrisma.draftCampaign.findFirst.mockResolvedValue({ id: 'camp-1', profileId: 'profile-1', data: {} });
    mockPrisma.draftCampaign.update.mockResolvedValue({ id: 'camp-1', name: 'New Name' });

    const result = await DraftCampaignService.update('camp-1', { name: 'New Name' }, 'profile-1');
    expect(result).toEqual({ id: 'camp-1', name: 'New Name' });
  });

  it('delete with profileId throws notFound when ownership fails', async () => {
    mockPrisma.draftCampaign.findFirst.mockResolvedValue(null);

    await expect(
      DraftCampaignService.delete('camp-1', 'wrong-profile')
    ).rejects.toMatchObject({ notFound: true });
  });

  it('delete with profileId succeeds when ownership matches', async () => {
    mockPrisma.draftCampaign.findFirst.mockResolvedValue({ id: 'camp-1' });
    mockPrisma.draftCampaign.delete.mockResolvedValue({ id: 'camp-1' });

    await DraftCampaignService.delete('camp-1', 'profile-1');
    expect(mockPrisma.draftCampaign.delete).toHaveBeenCalledWith({ where: { id: 'camp-1' } });
  });
});

describe('DraftAdSetService ownership enforcement', () => {
  it('update with profileId throws notFound when ownership fails', async () => {
    mockPrisma.draftAdSet.findFirst.mockResolvedValue(null);

    await expect(
      DraftAdSetService.update('adset-1', { name: 'New' }, 'wrong-profile')
    ).rejects.toMatchObject({ notFound: true });
  });

  it('update with profileId succeeds when ownership matches', async () => {
    mockPrisma.draftAdSet.findFirst.mockResolvedValue({ id: 'adset-1', profileId: 'profile-1', data: {} });
    mockPrisma.draftAdSet.update.mockResolvedValue({ id: 'adset-1' });

    const result = await DraftAdSetService.update('adset-1', { name: 'New' }, 'profile-1');
    expect(result).toBeDefined();
  });
});

describe('DraftAdService ownership enforcement', () => {
  it('update with profileId throws notFound when ownership fails', async () => {
    mockPrisma.draftAd.findFirst.mockResolvedValue(null);

    await expect(
      DraftAdService.update('ad-1', { name: 'New' }, 'wrong-profile')
    ).rejects.toMatchObject({ notFound: true });
  });

  it('update with profileId succeeds when ownership matches', async () => {
    mockPrisma.draftAd.findFirst.mockResolvedValue({ id: 'ad-1', profileId: 'profile-1' });
    mockPrisma.draftAd.update.mockResolvedValue({ id: 'ad-1' });

    const result = await DraftAdService.update('ad-1', { name: 'New' }, 'profile-1');
    expect(result).toBeDefined();
  });
});
