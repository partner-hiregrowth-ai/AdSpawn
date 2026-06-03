import { Response } from 'express';
import { WideCreationService, WideCreationTemplate } from '../services/draft/WideCreationService';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../prisma';

export class WideCreationController {
  static async validate(req: AuthRequest, res: Response) {
    try {
      const template = req.body as WideCreationTemplate;
      const result = await WideCreationService.validateTemplate(template);
      res.json(result);
    } catch (error: any) {
      console.error(`[WideCreation] Error in validate:`, error);
      res.status(500).json({ error: error.message });
    }
  }

  static async generate(req: AuthRequest, res: Response) {
    try {
      const template = req.body as WideCreationTemplate;

      // Structural checks only (adAccountId, campaigns exist, valid objectives)
      if (!template.adAccountId) {
        return res.status(400).json({ error: 'adAccountId is required' });
      }
      if (!template.campaigns || template.campaigns.length === 0) {
        return res.status(400).json({ error: 'At least one campaign is required' });
      }

      // Cap total entities to keep the transaction inside its 30s window.
      const totalEntities = template.campaigns.reduce((sum, c) => {
        const adSets = c.adSets ?? Array.from({ length: c.adSetCount || 1 });
        const adsPerSet = (adSets as any[]).reduce(
          (s, as) => s + ((as.ads?.length) ?? as.adCount ?? 1),
          0,
        );
        return sum + 1 + adSets.length + adsPerSet;
      }, 0);
      const MAX_ENTITIES = 500;
      if (totalEntities > MAX_ENTITIES) {
        return res.status(413).json({
          error: `Template would generate ${totalEntities} entities (max ${MAX_ENTITIES}). Reduce campaign/ad-set/ad counts.`,
        });
      }

      // Full validation before generating
      const validation = await WideCreationService.validateTemplate(template);
      if (!validation.valid) {
        return res.status(400).json({ error: 'Validation failed', errors: validation.errors });
      }

      const result = await WideCreationService.generateFromTemplate(template, req.profileId!);

      for (const campaignId of result.campaignIds) {
        await prisma.duplicateJob.create({
          data: {
            userId: req.userId!,
            profileId: req.profileId || null,
            status: 'COMPLETED',
            type: 'CAMPAIGN',
            sourceId: template.adAccountId,
            targetId: campaignId,
            details: {
              operation: 'WIDE_CREATE',
              adAccountId: template.adAccountId,
              templateName: template.name,
              totalCreated: result.totalCreated,
            },
          },
        });
      }

      res.json(result);
    } catch (error: any) {
      console.error(`[WideCreation] Error in generate:`, error);
      res.status(500).json({ error: error.message });
    }
  }

  static async bulkApplyFields(req: AuthRequest, res: Response) {
    try {
      const { entityIds, entityType, fieldUpdates, cascadeToChildren } = req.body as {
        entityIds: string[];
        entityType: 'campaign' | 'adSet' | 'ad';
        fieldUpdates: Record<string, any>;
        cascadeToChildren?: boolean;
      };

      if (!Array.isArray(entityIds) || entityIds.length === 0) {
        return res.status(400).json({ error: 'entityIds must be a non-empty array' });
      }
      if (!fieldUpdates || Object.keys(fieldUpdates).length === 0) {
        return res.status(400).json({ error: 'fieldUpdates must be a non-empty object' });
      }

      const result = await WideCreationService.bulkApplyFields(
        entityIds, entityType, fieldUpdates, cascadeToChildren, req.profileId,
      );
      res.json(result);
    } catch (error: any) {
      console.error(`[WideCreation] Error in bulkApplyFields:`, error);
      res.status(500).json({ error: error.message });
    }
  }

  static async getTree(req: AuthRequest, res: Response) {
    try {
      const { campaignIds } = req.body as { campaignIds: string[] };

      if (!Array.isArray(campaignIds) || campaignIds.length === 0) {
        return res.status(400).json({ error: 'campaignIds must be a non-empty array' });
      }

      const tree = await WideCreationService.getTreeStructure(campaignIds, req.profileId);
      res.json(tree);
    } catch (error: any) {
      console.error(`[WideCreation] Error in getTree:`, error);
      res.status(500).json({ error: error.message });
    }
  }
}
