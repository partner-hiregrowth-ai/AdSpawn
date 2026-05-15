import { prisma } from '../../prisma';
import { DraftStatus } from '@prisma/client';

export class DraftAdSetService {
  static async create(userId: string, adAccountId: string, draftCampaignId: string, name: string, data: any) {
    return prisma.draftAdSet.create({
      data: {
        userId,
        adAccountId,
        draftCampaignId,
        name,
        data,
        status: DraftStatus.DRAFT,
      },
    });
  }

  static async getById(id: string) {
    return prisma.draftAdSet.findUnique({
      where: { id },
      include: {
        ads: true,
        campaign: true,
      },
    });
  }

  static async update(id: string, updateData: any) {
    const { id: _id, ads, campaign, user, createdAt, updatedAt, userId, draftCampaignId, _count, ...cleanData } = updateData;
    return prisma.draftAdSet.update({
      where: { id },
      data: cleanData,
    });
  }

  static async delete(id: string) {
    return prisma.draftAdSet.delete({
      where: { id },
    });
  }
}
