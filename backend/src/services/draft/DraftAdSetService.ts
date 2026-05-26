import { prisma } from '../../prisma';
import { DraftStatus } from '@prisma/client';

function throwNotFound(entity: string): never {
  const err: any = new Error(`${entity} not found`);
  err.notFound = true;
  throw err;
}

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

  static async getById(id: string, userId?: string) {
    if (userId) {
      return prisma.draftAdSet.findFirst({
        where: { id, userId },
        include: { ads: true, campaign: true },
      });
    }
    return prisma.draftAdSet.findUnique({
      where: { id },
      include: { ads: true, campaign: true },
    });
  }

  static async update(id: string, updateData: any, userId?: string) {
    const { id: _id, ads, campaign, user, createdAt, updatedAt, userId: _userId, draftCampaignId, _count, ...cleanData } = updateData;

    if (userId) {
      const existing = await prisma.draftAdSet.findFirst({ where: { id, userId } });
      if (!existing) throwNotFound('Ad set');
      if (existing.metaId && cleanData.data && typeof cleanData.data === 'object') {
        const existingData = existing.data as any;
        const { IMMUTABLE_ADSET_FIELDS } = require('./MetaFieldRegistry');
        for (const field of IMMUTABLE_ADSET_FIELDS) {
          if (cleanData.data[field] !== undefined &&
              existingData[field] !== undefined &&
              JSON.stringify(cleanData.data[field]) !== JSON.stringify(existingData[field])) {
            if (existingData[`_original_${field}`] === undefined) {
              cleanData.data[`_original_${field}`] = existingData[field];
            } else {
              cleanData.data[`_original_${field}`] = existingData[`_original_${field}`];
            }
          } else if (existingData[`_original_${field}`] !== undefined) {
            cleanData.data[`_original_${field}`] = existingData[`_original_${field}`];
          }
        }
      }
    } else if (cleanData.data) {
      const existing = await prisma.draftAdSet.findUnique({ where: { id } });
      if (existing?.metaId && typeof cleanData.data === 'object') {
        const existingData = existing.data as any;
        const { IMMUTABLE_ADSET_FIELDS } = require('./MetaFieldRegistry');
        for (const field of IMMUTABLE_ADSET_FIELDS) {
          if (cleanData.data[field] !== undefined &&
              existingData[field] !== undefined &&
              JSON.stringify(cleanData.data[field]) !== JSON.stringify(existingData[field])) {
            if (existingData[`_original_${field}`] === undefined) {
              cleanData.data[`_original_${field}`] = existingData[field];
            } else {
              cleanData.data[`_original_${field}`] = existingData[`_original_${field}`];
            }
          } else if (existingData[`_original_${field}`] !== undefined) {
            cleanData.data[`_original_${field}`] = existingData[`_original_${field}`];
          }
        }
      }
    }

    return prisma.draftAdSet.update({
      where: { id },
      data: cleanData,
    });
  }

  static async delete(id: string, userId?: string) {
    if (userId) {
      const exists = await prisma.draftAdSet.findFirst({ where: { id, userId } });
      if (!exists) throwNotFound('Ad set');
    }
    return prisma.draftAdSet.delete({
      where: { id },
    });
  }
}
