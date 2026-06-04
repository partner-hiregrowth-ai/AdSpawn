import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../prisma';
import { Prisma } from '@prisma/client';

export const getTeamActivity = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.teamId) {
      return res.status(400).json({ message: 'No team associated with your account' });
    }

    const scope = typeof req.query.scope === 'string' ? req.query.scope : 'mine';
    const filter = typeof req.query.filter === 'string' ? req.query.filter : undefined;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 30));

    const where: any = {};
    if (scope === 'team') {
      const teamUserIds = (
        await prisma.user.findMany({
          where: { teamId: req.teamId },
          select: { id: true },
        })
      ).map((u) => u.id);
      where.userId = { in: teamUserIds };
    } else if (req.profileId) {
      where.profileId = req.profileId;
    } else {
      where.userId = req.userId;
    }

    if (filter && filter !== 'all') {
      switch (filter) {
        case 'publish':
          where.details = { path: ['operation'], equals: 'PUBLISH' };
          break;
        case 'conversion':
          where.details = { path: ['isConversion'], equals: true };
          break;
        case 'draft':
          where.OR = [
            { details: { path: ['operation'], equals: 'DRAFT_DUPLICATE' } },
            { AND: [
              { details: { path: ['isConversion'], equals: true } },
              { details: { path: ['savedAsDraft'], equals: true } },
            ]},
          ];
          break;
        case 'ai_create':
          where.details = { path: ['operation'], equals: 'AI_CREATE' };
          break;
        case 'wide_create':
          where.details = { path: ['operation'], equals: 'WIDE_CREATE' };
          break;
        case 'duplicate':
          where.AND = [
            { OR: [{ details: { equals: Prisma.DbNull } }, { details: { path: ['operation'], not: 'PUBLISH' } }] },
            { OR: [{ details: { equals: Prisma.DbNull } }, { NOT: { details: { path: ['isConversion'], equals: true } } }] },
            { OR: [{ details: { equals: Prisma.DbNull } }, { NOT: { details: { path: ['operation'], equals: 'AI_CREATE' } } }] },
            { OR: [{ details: { equals: Prisma.DbNull } }, { NOT: { details: { path: ['operation'], equals: 'WIDE_CREATE' } } }] },
            { OR: [{ details: { equals: Prisma.DbNull } }, { NOT: { details: { path: ['operation'], equals: 'DRAFT_DUPLICATE' } } }] },
          ];
          break;
      }
    }

    const [items, total] = await Promise.all([
      prisma.duplicateJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { id: true, name: true, email: true } },
          profile: { select: { id: true, name: true } },
        },
      }),
      prisma.duplicateJob.count({ where }),
    ]);

    res.json({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error: any) {
    console.error('[Activity] Failed to fetch team activity:', error);
    res.status(500).json({ message: 'Failed to fetch activity feed' });
  }
};
