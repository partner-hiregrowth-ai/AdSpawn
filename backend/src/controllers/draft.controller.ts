import { Request, Response } from 'express';
import { DraftService } from '../services/draft/DraftService';
import { DraftCampaignService } from '../services/draft/DraftCampaignService';
import { DraftAdSetService } from '../services/draft/DraftAdSetService';
import { DraftAdService } from '../services/draft/DraftAdService';
import { DraftValidationEngine } from '../services/draft/DraftValidationEngine';
import { DraftPublishService, PublishError } from '../services/draft/DraftPublishService';
import { BulkEditCompatibilityEngine, EntityLevel } from '../services/draft/BulkEditCompatibilityEngine';
import { MetaFormSchemaEngine } from '../services/draft/MetaFormSchemaEngine';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../prisma';

function isFacebookAuthError(message: string): boolean {
  return message?.includes('OAuthException') || message?.includes('access token') || message?.includes('Session has expired');
}

export class DraftController {
  static async duplicateToDraft(req: Request, res: Response) {
    const { campaignId, count } = req.body;
    const authReq = req as AuthRequest;
    const numCopies = Math.max(1, Math.min(50, Number(count) || 1));

    const drafts: any[] = [];
    const failures: { iteration: number; error: string }[] = [];

    for (let i = 0; i < numCopies; i++) {
      try {
        const draft = await DraftService.duplicateCampaignToDraft(
          campaignId,
          authReq.profileId!,
          authReq.userAccessToken!,
          { iteration: numCopies > 1 ? i + 1 : 0 },
        );
        drafts.push(draft);
        await prisma.duplicateJob.create({
          data: {
            userId: authReq.userId!,
            profileId: authReq.profileId || null,
            status: 'COMPLETED',
            type: 'CAMPAIGN',
            sourceId: campaignId,
            targetId: draft.id,
            details: { operation: 'DRAFT_DUPLICATE', name: draft.name },
          },
        });
      } catch (error: any) {
        const msg = error?.response?.data?.error?.error_user_msg
          || error?.response?.data?.error?.message
          || error?.message
          || 'unknown error';
        console.error(`[DraftController] duplicateToDraft copy ${i + 1}/${numCopies} failed:`, msg);
        failures.push({ iteration: i + 1, error: msg });
        prisma.duplicateJob.create({
          data: {
            userId: authReq.userId!,
            profileId: authReq.profileId || null,
            status: 'FAILED',
            type: 'CAMPAIGN',
            sourceId: campaignId,
            details: { operation: 'DRAFT_DUPLICATE', iteration: i + 1, error: msg },
          },
        }).catch(() => {});
      }
    }

    if (drafts.length === 0) {
      const firstErr = failures[0]?.error || 'No drafts were created.';
      return res.status(500).json({ error: firstErr, failures });
    }

    res.json({
      success: failures.length === 0,
      requested: numCopies,
      created: drafts.length,
      failed: failures.length,
      drafts,
      failures,
      ...drafts[0],
    });
  }

  static async listCampaigns(req: Request, res: Response) {
    try {
      const { profileId } = req as AuthRequest;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 50));
      const result = await DraftCampaignService.listByProfile(profileId!, page, pageSize);
      res.json(result);
    } catch (error: any) {
      console.error(`[DraftController] Error in listCampaigns:`, error);
      res.status(500).json({ error: error.message });
    }
  }

  static async getCampaign(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { profileId } = req as AuthRequest;
      const draft = await DraftCampaignService.getById(id, profileId);
      if (!draft) return res.status(404).json({ error: 'Draft not found' });
      res.json(draft);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateCampaign(req: Request, res: Response) {
    const id = req.params.id as string;
    const { profileId } = req as AuthRequest;
    try {
      console.log(`[DraftController] Updating campaign: ${id}`, req.body);
      const draft = await DraftCampaignService.update(id, req.body, profileId);
      res.json(draft);
    } catch (error: any) {
      console.error(`[DraftController] Error updating campaign ${id}:`, error);
      if (error.notFound) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  static async updateAdSet(req: Request, res: Response) {
    const id = req.params.id as string;
    const { profileId } = req as AuthRequest;
    try {
      console.log(`[DraftController] Updating adset: ${id}`, req.body);
      const draft = await DraftAdSetService.update(id, req.body, profileId);
      res.json(draft);
    } catch (error: any) {
      console.error(`[DraftController] Error updating adset ${id}:`, error);
      if (error.notFound) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  static async updateAd(req: Request, res: Response) {
    const id = req.params.id as string;
    const { profileId } = req as AuthRequest;
    try {
      console.log(`[DraftController] Updating ad: ${id}`, req.body);
      const draft = await DraftAdService.update(id, req.body, profileId);
      res.json(draft);
    } catch (error: any) {
      console.error(`[DraftController] Error updating ad ${id}:`, error);
      if (error.notFound) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  static async validateDraft(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { profileId } = req as AuthRequest;
      const draft = await DraftCampaignService.getById(id, profileId);
      if (!draft) return res.status(404).json({ error: 'Draft not found' });

      const validation = await DraftValidationEngine.validateFullDraft(draft);

      await DraftCampaignService.update(id, {
        validationErrors: validation.campaignErrors,
        status: validation.isValid ? 'VALIDATED' : 'VALIDATION_FAILED'
      }, profileId);

      for (const adSetId in validation.adSetErrors) {
        await DraftAdSetService.update(adSetId, { validationErrors: validation.adSetErrors[adSetId] }, profileId);
      }

      for (const adId in validation.adErrors) {
        await DraftAdService.update(adId, { validationErrors: validation.adErrors[adId] }, profileId);
      }

      res.json(validation);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async publishDraft(req: Request, res: Response) {
    const id = req.params.id as string;
    const authReq = req as AuthRequest;
    try {
      const owned = await prisma.draftCampaign.findFirst({ where: { id, profileId: authReq.profileId } });
      if (!owned) return res.status(404).json({ error: 'Draft not found' });
      const result = await DraftPublishService.publishCampaign(id, authReq.userAccessToken!);
      await prisma.duplicateJob.create({
        data: {
          userId: authReq.userId!,
          profileId: authReq.profileId || null,
          status: 'COMPLETED',
          type: 'CAMPAIGN',
          sourceId: id,
          targetId: result.metaCampaignId,
          details: { operation: 'PUBLISH' },
        },
      });
      res.json(result);
    } catch (error: any) {
      console.error(`[DraftController] Error in publishDraft:`, error);
      if (isFacebookAuthError(error.message)) {
        return res.status(401).json({ error: error.message, code: 'TOKEN_EXPIRED' });
      }
      const userMessage = error instanceof PublishError ? error.userMessage : error.message;
      prisma.duplicateJob.create({
        data: {
          userId: authReq.userId!,
          profileId: authReq.profileId || null,
          status: 'FAILED',
          type: 'CAMPAIGN',
          sourceId: id,
          details: { operation: 'PUBLISH', error: userMessage },
        },
      }).catch(() => {});
      res.status(500).json({ error: error.message, userMessage });
    }
  }

  static async bulkPublishDrafts(req: Request, res: Response) {
    try {
      const { campaignIds } = req.body as { campaignIds: string[] };
      const authReq = req as AuthRequest;

      if (!Array.isArray(campaignIds) || campaignIds.length === 0) {
        return res.status(400).json({ error: 'campaignIds must be a non-empty array' });
      }

      const ownedCampaigns = await prisma.draftCampaign.findMany({
        where: { id: { in: campaignIds }, profileId: authReq.profileId },
        select: { id: true },
      });
      const ownedIds = new Set(ownedCampaigns.map(c => c.id));

      const results: { id: string; success: boolean; metaCampaignId?: string; error?: string; userMessage?: string }[] = [];
      for (const id of campaignIds) {
        if (!ownedIds.has(id)) {
          results.push({ id, success: false, error: 'Draft not found' });
          continue;
        }
        try {
          const result = await DraftPublishService.publishCampaign(id, authReq.userAccessToken!);
          results.push({ id, success: true, metaCampaignId: result.metaCampaignId });
          await prisma.duplicateJob.create({
            data: {
              userId: authReq.userId!,
              profileId: authReq.profileId || null,
              status: 'COMPLETED',
              type: 'CAMPAIGN',
              sourceId: id,
              targetId: result.metaCampaignId,
              details: { operation: 'PUBLISH' },
            },
          });
        } catch (error: any) {
          if (isFacebookAuthError(error.message)) {
            return res.status(401).json({ error: error.message, code: 'TOKEN_EXPIRED', results });
          }
          const userMessage = error instanceof PublishError ? error.userMessage : error.message;
          results.push({ id, success: false, error: error.message, userMessage });
          prisma.duplicateJob.create({
            data: {
              userId: authReq.userId!,
              profileId: authReq.profileId || null,
              status: 'FAILED',
              type: 'CAMPAIGN',
              sourceId: id,
              details: { operation: 'PUBLISH', error: userMessage },
            },
          }).catch(() => {});
        }
      }

      res.json({ results });
    } catch (error: any) {
      console.error(`[DraftController] Error in bulkPublishDrafts:`, error);
      res.status(500).json({ error: error.message });
    }
  }

  static async deleteCampaign(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { profileId } = req as AuthRequest;
      await DraftCampaignService.delete(id, profileId);
      res.json({ success: true });
    } catch (error: any) {
      if (error.notFound) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  static async bulkUpdateCampaigns(req: Request, res: Response) {
    try {
      const { campaignIds, updates } = req.body as {
        campaignIds: string[];
        updates: { objective?: string; data?: Record<string, any> };
      };
      const { profileId } = req as AuthRequest;

      if (!Array.isArray(campaignIds) || campaignIds.length === 0) {
        return res.status(400).json({ error: 'campaignIds must be a non-empty array' });
      }

      const candidates = await prisma.draftCampaign.findMany({
        where: { id: { in: campaignIds }, profileId, status: { not: 'PUBLISHING' } },
        select: { id: true, data: true },
      });

      if (candidates.length === 0) {
        return res.json({ updated: 0 });
      }

      if (updates.data) {
        const basePayload: any = { status: 'DRAFT' };
        if (updates.objective !== undefined) basePayload.objective = updates.objective;
        await prisma.$transaction(
          candidates.map((c) =>
            prisma.draftCampaign.update({
              where: { id: c.id },
              data: { ...basePayload, data: { ...(c.data as any), ...updates.data } },
            })
          )
        );
      } else {
        const updatePayload: any = { status: 'DRAFT' };
        if (updates.objective !== undefined) updatePayload.objective = updates.objective;
        await prisma.draftCampaign.updateMany({
          where: { id: { in: candidates.map((c) => c.id) } },
          data: updatePayload,
        });
      }

      res.json({ updated: candidates.length });
    } catch (error: any) {
      console.error(`[DraftController] Error in bulkUpdateCampaigns:`, error);
      res.status(500).json({ error: error.message });
    }
  }

  static async cleanupMetaObjects(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const authReq = req as AuthRequest;

      const owned = await prisma.draftCampaign.findFirst({ where: { id, profileId: authReq.profileId } });
      if (!owned) return res.status(404).json({ error: 'Draft not found' });
      const result = await DraftPublishService.cleanupOrphanedMetaObjects(id, authReq.userAccessToken!);
      res.json(result);
    } catch (error: any) {
      console.error(`[DraftController] Error in cleanupMetaObjects:`, error);
      if (isFacebookAuthError(error.message)) {
        return res.status(401).json({ error: error.message, code: 'TOKEN_EXPIRED' });
      }
      res.status(500).json({ error: error.message });
    }
  }

  static async bulkDeleteDrafts(req: Request, res: Response) {
    try {
      const { campaignIds } = req.body as { campaignIds: string[] };
      const { profileId } = req as AuthRequest;

      if (!Array.isArray(campaignIds) || campaignIds.length === 0) {
        return res.status(400).json({ error: 'campaignIds must be a non-empty array' });
      }

      const deleted = await prisma.draftCampaign.deleteMany({
        where: {
          id: { in: campaignIds },
          profileId,
          status: { not: 'PUBLISHING' },
        },
      });

      res.json({ deleted: deleted.count });
    } catch (error: any) {
      console.error(`[DraftController] Error in bulkDeleteDrafts:`, error);
      res.status(500).json({ error: error.message });
    }
  }

  static async bulkEditSchema(req: Request, res: Response) {
    try {
      const { draftIds, level = 'campaign' } = req.body as { draftIds: string[]; level?: EntityLevel };
      const { profileId } = req as AuthRequest;

      if (!Array.isArray(draftIds) || draftIds.length === 0) {
        return res.status(400).json({ error: 'draftIds must be a non-empty array' });
      }

      let drafts: any[];
      if (level === 'campaign') {
        drafts = await prisma.draftCampaign.findMany({
          where: { id: { in: draftIds }, profileId },
        });
      } else if (level === 'adSet') {
        drafts = await prisma.draftAdSet.findMany({
          where: { id: { in: draftIds } },
          include: { campaign: { select: { objective: true, data: true } } },
        });
        drafts = drafts.map((d: any) => ({
          ...d,
          campaignObjective: d.campaign?.objective,
          isCBO: !!(d.campaign?.data as any)?.is_adset_budget_sharing_enabled,
        }));
      } else {
        drafts = await prisma.draftAd.findMany({
          where: { id: { in: draftIds } },
        });
      }

      if (drafts.length === 0) {
        return res.status(404).json({ error: 'No drafts found' });
      }

      const schema = BulkEditCompatibilityEngine.computeBulkSchema(drafts, level);
      res.json(schema);
    } catch (error: any) {
      console.error(`[DraftController] Error in bulkEditSchema:`, error);
      res.status(500).json({ error: error.message });
    }
  }

  static async bulkEditValidate(req: Request, res: Response) {
    try {
      const { draftIds, fieldUpdates, level = 'campaign' } = req.body as {
        draftIds: string[];
        fieldUpdates: Record<string, any>;
        level?: EntityLevel;
      };
      const { profileId } = req as AuthRequest;

      if (!Array.isArray(draftIds) || draftIds.length === 0) {
        return res.status(400).json({ error: 'draftIds must be a non-empty array' });
      }

      let drafts: any[];
      if (level === 'campaign') {
        drafts = await prisma.draftCampaign.findMany({
          where: { id: { in: draftIds }, profileId },
        });
      } else if (level === 'adSet') {
        drafts = await prisma.draftAdSet.findMany({
          where: { id: { in: draftIds } },
          include: { campaign: { select: { objective: true } } },
        });
        drafts = drafts.map((d: any) => ({ ...d, objective: d.campaign?.objective }));
      } else {
        drafts = await prisma.draftAd.findMany({ where: { id: { in: draftIds } } });
      }

      const result = BulkEditCompatibilityEngine.validateBulkEdit(drafts, fieldUpdates, level);
      res.json(result);
    } catch (error: any) {
      console.error(`[DraftController] Error in bulkEditValidate:`, error);
      res.status(500).json({ error: error.message });
    }
  }

  static async bulkEditApply(req: Request, res: Response) {
    try {
      const { draftIds, fieldUpdates, level = 'campaign' } = req.body as {
        draftIds: string[];
        fieldUpdates: Record<string, any>;
        level?: EntityLevel;
      };
      const { profileId } = req as AuthRequest;

      if (!Array.isArray(draftIds) || draftIds.length === 0) {
        return res.status(400).json({ error: 'draftIds must be a non-empty array' });
      }

      if (!fieldUpdates || Object.keys(fieldUpdates).length === 0) {
        return res.status(400).json({ error: 'fieldUpdates must be a non-empty object' });
      }

      const { updatedCount, validation, conflict } = await prisma.$transaction(async (tx) => {
        let drafts: any[];
        if (level === 'campaign') {
          drafts = await tx.draftCampaign.findMany({
            where: { id: { in: draftIds }, profileId, status: { not: 'PUBLISHING' } },
          });
        } else if (level === 'adSet') {
          drafts = await tx.draftAdSet.findMany({
            where: { id: { in: draftIds } },
            include: { campaign: { select: { objective: true, profileId: true } } },
          });
          drafts = drafts.filter((d: any) => d.campaign?.profileId === profileId);
        } else {
          drafts = await tx.draftAd.findMany({
            where: { id: { in: draftIds } },
            include: { adSet: { include: { campaign: { select: { profileId: true } } } } },
          });
          drafts = drafts.filter((d: any) => d.adSet?.campaign?.profileId === profileId);
        }

        const validation = BulkEditCompatibilityEngine.validateBulkEdit(drafts, fieldUpdates, level);
        if (!validation.valid) {
          return { updatedCount: 0, validation, conflict: false };
        }

        const updates = BulkEditCompatibilityEngine.applyBulkEdit(drafts, fieldUpdates, level);
        let updatedCount = 0;

        for (const update of updates) {
          const updatePayload: any = { data: update.updatedData, status: 'DRAFT' };
          if (update.objective) updatePayload.objective = update.objective;

          let result;
          if (level === 'campaign') {
            result = await tx.draftCampaign.updateMany({
              where: { id: update.draftId, status: { not: 'PUBLISHING' } },
              data: updatePayload,
            });
          } else if (level === 'adSet') {
            result = await tx.draftAdSet.updateMany({
              where: { id: update.draftId },
              data: { data: update.updatedData },
            });
          } else {
            result = await tx.draftAd.updateMany({
              where: { id: update.draftId },
              data: { data: update.updatedData },
            });
          }
          if (result.count === 1) updatedCount++;
        }

        return { updatedCount, validation, conflict: updatedCount < updates.length };
      });

      if (!validation.valid) {
        return res.status(400).json({ error: 'Validation failed', ...validation });
      }
      if (conflict) {
        return res.status(409).json({
          updated: updatedCount,
          validation,
          error: 'one or more drafts are publishing; partial update applied',
        });
      }

      res.json({ updated: updatedCount, validation });
    } catch (error: any) {
      console.error(`[DraftController] Error in bulkEditApply:`, error);
      res.status(500).json({ error: error.message });
    }
  }

  static async exportCampaign(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { profileId } = req as AuthRequest;

      const campaign = await prisma.draftCampaign.findFirst({
        where: { id, profileId },
        include: {
          adSets: {
            include: { ads: true },
          },
        },
      });

      if (!campaign) return res.status(404).json({ error: 'Draft not found' });

      const exported = {
        version: 1,
        exportedAt: new Date().toISOString(),
        campaign: {
          name: campaign.name,
          objective: campaign.objective,
          adAccountId: campaign.adAccountId,
          data: campaign.data,
          adSets: campaign.adSets.map((adSet) => ({
            name: adSet.name,
            data: adSet.data,
            ads: adSet.ads.map((ad) => ({
              name: ad.name,
              data: ad.data,
            })),
          })),
        },
      };

      res.json(exported);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async importCampaign(req: Request, res: Response) {
    try {
      const { profileId } = req as AuthRequest;
      const { exported, adAccountId } = req.body as {
        exported: {
          version: number;
          campaign: {
            name: string;
            objective: string;
            adAccountId: string;
            data: any;
            adSets: Array<{
              name: string;
              data: any;
              ads: Array<{ name: string; data: any }>;
            }>;
          };
        };
        adAccountId?: string;
      };

      if (!exported?.campaign) {
        return res.status(400).json({ error: 'Invalid export format' });
      }

      const targetAccountId = adAccountId || exported.campaign.adAccountId;
      const { campaign: src } = exported;

      const campaign = await prisma.draftCampaign.create({
        data: {
          profileId: profileId!,
          adAccountId: targetAccountId,
          name: src.name,
          objective: src.objective || null,
          data: src.data || {},
          status: 'DRAFT',
        },
      });

      for (const srcAdSet of src.adSets || []) {
        const adSet = await prisma.draftAdSet.create({
          data: {
            draftCampaignId: campaign.id,
            profileId: profileId!,
            adAccountId: targetAccountId,
            name: srcAdSet.name,
            data: srcAdSet.data || {},
            status: 'DRAFT',
          },
        });

        for (const srcAd of srcAdSet.ads || []) {
          await prisma.draftAd.create({
            data: {
              draftAdSetId: adSet.id,
              profileId: profileId!,
              adAccountId: targetAccountId,
              name: srcAd.name,
              data: srcAd.data || {},
              status: 'DRAFT',
            },
          });
        }
      }

      const result = await prisma.draftCampaign.findUnique({
        where: { id: campaign.id },
        include: {
          adSets: { include: { ads: true } },
          _count: { select: { adSets: true } },
        },
      });

      res.json(result);
    } catch (error: any) {
      console.error('[DraftController] Error in importCampaign:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async getFormSchema(req: Request, res: Response) {
    try {
      const { entityType, context } = req.body as {
        entityType: 'campaign' | 'adSet' | 'ad';
        context?: { objective?: string; buyingType?: string; isCBO?: boolean; destinationType?: string };
      };

      let schema;
      switch (entityType) {
        case 'campaign':
          schema = MetaFormSchemaEngine.getCampaignFormSchema(context);
          break;
        case 'adSet':
          schema = MetaFormSchemaEngine.getAdSetFormSchema(context || { objective: 'OUTCOME_TRAFFIC' });
          break;
        case 'ad':
          schema = MetaFormSchemaEngine.getAdFormSchema(context);
          break;
        default:
          return res.status(400).json({ error: 'Invalid entityType' });
      }

      res.json(schema);
    } catch (error: any) {
      console.error(`[DraftController] Error in getFormSchema:`, error);
      res.status(500).json({ error: error.message });
    }
  }

  static async shareDraft(req: Request, res: Response) {
    const id = req.params.id as string;
    const authReq = req as AuthRequest;
    const { profileId: targetProfileId, permission = 'view' } = req.body;
    try {
      if (!targetProfileId) return res.status(400).json({ error: 'profileId is required' });
      if (targetProfileId === authReq.profileId) return res.status(400).json({ error: 'Cannot share with yourself' });

      const draft = await prisma.draftCampaign.findFirst({ where: { id, profileId: authReq.profileId } });
      if (!draft) return res.status(404).json({ error: 'Draft not found' });

      const share = await prisma.draftShare.create({
        data: {
          draftCampaignId: id,
          sharedByProfileId: authReq.profileId!,
          sharedWithProfileId: targetProfileId,
          permission,
        },
        include: { sharedWith: { select: { id: true, name: true } } },
      });
      res.json(share);
    } catch (error: any) {
      if (error.code === 'P2002') return res.status(409).json({ error: 'Already shared with this profile' });
      res.status(500).json({ error: error.message });
    }
  }

  static async revokeDraftShare(req: Request, res: Response) {
    const id = req.params.id as string;
    const shareId = req.params.shareId as string;
    const { profileId } = req as AuthRequest;
    try {
      const share = await prisma.draftShare.findFirst({
        where: { id: shareId, draftCampaignId: id },
        include: { draftCampaign: { select: { profileId: true } } },
      });
      if (!share || share.draftCampaign.profileId !== profileId) {
        return res.status(404).json({ error: 'Share not found' });
      }
      await prisma.draftShare.delete({ where: { id: shareId } });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getDraftShares(req: Request, res: Response) {
    const id = req.params.id as string;
    const { profileId } = req as AuthRequest;
    try {
      const campaign = await prisma.draftCampaign.findFirst({ where: { id, profileId } });
      if (!campaign) return res.status(404).json({ error: 'Draft not found' });

      const shares = await prisma.draftShare.findMany({
        where: { draftCampaignId: id },
        include: {
          sharedWith: { select: { id: true, name: true } },
          sharedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      });
      res.json(shares);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async bulkShareDrafts(req: Request, res: Response) {
    const authReq = req as AuthRequest;
    const { campaignIds, profileIds, permission = 'view' } = req.body;
    try {
      if (!Array.isArray(campaignIds) || campaignIds.length === 0) return res.status(400).json({ error: 'campaignIds is required' });
      if (!Array.isArray(profileIds) || profileIds.length === 0) return res.status(400).json({ error: 'profileIds is required' });
      if (profileIds.includes(authReq.profileId)) return res.status(400).json({ error: 'Cannot share with yourself' });

      const ownedCount = await prisma.draftCampaign.count({
        where: { id: { in: campaignIds }, profileId: authReq.profileId },
      });
      if (ownedCount !== campaignIds.length) {
        return res.status(404).json({ error: 'One or more drafts not found' });
      }

      const data = campaignIds.flatMap((cid: string) =>
        profileIds.map((pid: string) => ({
          draftCampaignId: cid,
          sharedByProfileId: authReq.profileId!,
          sharedWithProfileId: pid,
          permission,
        }))
      );

      const result = await prisma.draftShare.createMany({ data, skipDuplicates: true });
      res.json({ created: result.count, total: data.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getSharedWithMe(req: Request, res: Response) {
    const authReq = req as AuthRequest;
    try {
      const shares = await prisma.draftShare.findMany({
        where: { sharedWithProfileId: authReq.profileId! },
        include: {
          draftCampaign: {
            include: {
              _count: { select: { adSets: true } },
              adSets: { select: { _count: { select: { ads: true } } } },
            },
          },
          sharedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      const enriched = shares.map(({ draftCampaign, ...rest }) => {
        if (!draftCampaign) return { ...rest, draftCampaign };
        const { adSets, ...campaign } = draftCampaign;
        return {
          ...rest,
          draftCampaign: {
            ...campaign,
            _count: { ...campaign._count, ads: adSets.reduce((sum, s) => sum + s._count.ads, 0) },
          },
        };
      });
      res.json(enriched);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
