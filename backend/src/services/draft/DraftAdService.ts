import { prisma } from '../../prisma';
import { DraftStatus } from '@prisma/client';

function throwNotFound(entity: string): never {
  const err: any = new Error(`${entity} not found`);
  err.notFound = true;
  throw err;
}

export class DraftAdService {
  static async create(profileId: string, adAccountId: string, draftAdSetId: string, name: string, data: any) {
    return prisma.draftAd.create({
      data: {
        profileId,
        adAccountId,
        draftAdSetId,
        name,
        data,
        status: DraftStatus.DRAFT,
      },
    });
  }

  static async getById(id: string, profileId?: string) {
    if (profileId) {
      return prisma.draftAd.findFirst({
        where: {
          id,
          OR: [
            { profileId },
            { adSet: { campaign: { shares: { some: { sharedWithProfileId: profileId } } } } },
          ],
        },
        include: { adSet: { include: { campaign: true } } },
      });
    }
    return prisma.draftAd.findUnique({
      where: { id },
      include: { adSet: { include: { campaign: true } } },
    });
  }

  static async update(id: string, updateData: any, profileId?: string) {
    if (profileId) {
      const exists = await prisma.draftAd.findFirst({
        where: {
          id,
          OR: [
            { profileId },
            { adSet: { campaign: { shares: { some: { sharedWithProfileId: profileId, permission: 'edit' } } } } },
          ],
        },
      });
      if (!exists) throwNotFound('Ad');
    }

    const cleanData: any = {};
    const allowedFields = ['name', 'status', 'data', 'validationErrors', 'metaId', 'adAccountId'];
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        cleanData[field] = updateData[field];
      }
    }

    return prisma.draftAd.update({
      where: { id },
      data: cleanData,
    });
  }

  static async delete(id: string, profileId?: string) {
    if (profileId) {
      const exists = await prisma.draftAd.findFirst({ where: { id, profileId } }); // owner-only
      if (!exists) throwNotFound('Ad');
    }
    return prisma.draftAd.delete({
      where: { id },
    });
  }
}
