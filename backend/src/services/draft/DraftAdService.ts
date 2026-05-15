import { prisma } from '../../prisma';
import { DraftStatus } from '@prisma/client';

export class DraftAdService {
  static async create(userId: string, adAccountId: string, draftAdSetId: string, name: string, data: any) {
    return prisma.draftAd.create({
      data: {
        userId,
        adAccountId,
        draftAdSetId,
        name,
        data,
        status: DraftStatus.DRAFT,
      },
    });
  }

  static async getById(id: string) {
    return prisma.draftAd.findUnique({
      where: { id },
      include: {
        adSet: {
          include: {
            campaign: true,
          },
        },
      },
    });
  }

  static async update(id: string, updateData: any) {
    const { id: _id, adSet, user, createdAt, updatedAt, userId, draftAdSetId, _count, ...cleanData } = updateData;
    return prisma.draftAd.update({
      where: { id },
      data: cleanData,
    });
  }

  static async delete(id: string) {
    return prisma.draftAd.delete({
      where: { id },
    });
  }
}
