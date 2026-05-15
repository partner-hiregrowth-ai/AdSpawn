import { prisma } from '../../prisma';
import { DraftStatus } from '@prisma/client';

export class DraftCampaignService {
  static async create(userId: string, adAccountId: string, name: string, objective: string, data: any) {
    return prisma.draftCampaign.create({
      data: {
        userId,
        adAccountId,
        name,
        objective,
        data,
        status: DraftStatus.DRAFT,
      },
    });
  }

  static async getById(id: string) {
    return prisma.draftCampaign.findUnique({
      where: { id },
      include: {
        adSets: {
          include: {
            ads: true,
          },
        },
      },
    });
  }

  static async listByUser(userId: string) {
    return prisma.draftCampaign.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { adSets: true },
        },
      },
    });
  }

  static async update(id: string, updateData: any) {
    const { id: _id, adSets, user, createdAt, updatedAt, userId, _count, ...cleanData } = updateData;
    return prisma.draftCampaign.update({
      where: { id },
      data: cleanData,
    });
  }

  static async delete(id: string) {
    return prisma.draftCampaign.delete({
      where: { id },
    });
  }
}
