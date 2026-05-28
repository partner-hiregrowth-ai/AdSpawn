import { prisma } from '../../prisma';
import { DraftStatus } from '@prisma/client';
import { IMMUTABLE_CAMPAIGN_FIELDS } from './MetaFieldRegistry';

function throwNotFound(entity: string): never {
  const err: any = new Error(`${entity} not found`);
  err.notFound = true;
  throw err;
}

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

  static async getById(id: string, userId?: string) {
    if (userId) {
      return prisma.draftCampaign.findFirst({
        where: { id, userId },
        include: {
          adSets: {
            include: {
              ads: true,
            },
          },
        },
      });
    }
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

  static async listByUser(userId: string, page = 1, pageSize = 50) {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      prisma.draftCampaign.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          _count: { select: { adSets: true } },
          adSets: { select: { _count: { select: { ads: true } } } },
        },
      }),
      prisma.draftCampaign.count({ where: { userId } }),
    ]);
    const enriched = items.map(({ adSets, ...rest }) => ({
      ...rest,
      _count: { ...rest._count, ads: adSets.reduce((sum, s) => sum + s._count.ads, 0) },
    }));
    return { items: enriched, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  static async update(id: string, updateData: any, userId?: string) {
    const cleanData: any = {};
    const allowedFields = ['name', 'status', 'data', 'validationErrors', 'metaId', 'adAccountId', 'objective'];
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        cleanData[field] = updateData[field];
      }
    }

    if (cleanData.data) {
      const existing = userId
        ? await prisma.draftCampaign.findFirst({ where: { id, userId } })
        : await prisma.draftCampaign.findUnique({ where: { id } });
      if (userId && !existing) throwNotFound('Campaign');
      if (existing?.metaId && typeof cleanData.data === 'object') {
        const existingData = existing.data as any;
        const warnings: string[] = [];
        for (const field of IMMUTABLE_CAMPAIGN_FIELDS) {
          if (cleanData.data[field] !== undefined &&
              existingData[field] !== undefined &&
              JSON.stringify(cleanData.data[field]) !== JSON.stringify(existingData[field])) {
            warnings.push(`${field} is immutable on Meta and will not be updated when re-published`);
            if (existingData[`_original_${field}`] === undefined) {
              cleanData.data[`_original_${field}`] = existingData[field];
            } else {
              cleanData.data[`_original_${field}`] = existingData[`_original_${field}`];
            }
          } else if (existingData[`_original_${field}`] !== undefined) {
            cleanData.data[`_original_${field}`] = existingData[`_original_${field}`];
          }
        }
        if (warnings.length > 0) {
          console.warn(`[DraftCampaignService] Immutable field edit on published draft ${id}:`, warnings);
        }
      }
    } else if (userId) {
      const exists = await prisma.draftCampaign.findFirst({ where: { id, userId } });
      if (!exists) throwNotFound('Campaign');
    }

    return prisma.draftCampaign.update({
      where: { id },
      data: cleanData,
    });
  }

  static async delete(id: string, userId?: string) {
    if (userId) {
      const exists = await prisma.draftCampaign.findFirst({ where: { id, userId } });
      if (!exists) throwNotFound('Campaign');
    }
    return prisma.draftCampaign.delete({
      where: { id },
    });
  }
}
