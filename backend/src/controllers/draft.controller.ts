import { Request, Response } from 'express';
import { DraftService } from '../services/draft/DraftService';
import { DraftCampaignService } from '../services/draft/DraftCampaignService';
import { DraftAdSetService } from '../services/draft/DraftAdSetService';
import { DraftAdService } from '../services/draft/DraftAdService';
import { DraftValidationEngine } from '../services/draft/DraftValidationEngine';
import { DraftPublishService } from '../services/draft/DraftPublishService';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../prisma';

function isFacebookAuthError(message: string): boolean {
  return message?.includes('OAuthException') || message?.includes('access token') || message?.includes('Session has expired');
}

export class DraftController {
  static async duplicateToDraft(req: Request, res: Response) {
    try {
      const { campaignId } = req.body;
      const { userId } = req as AuthRequest;
      
      console.log(`[DraftController] duplicateToDraft START for userId: ${userId}, campaignId: ${campaignId}`);
      
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.accessToken) {
        console.error(`[DraftController] User not found or missing access token for ID: ${userId}`);
        return res.status(401).json({ error: 'Unauthorized: Missing Facebook access token' });
      }

      const draft = await DraftService.duplicateCampaignToDraft(campaignId, userId!, user.accessToken);
      console.log(`[DraftController] duplicateToDraft SUCCESS for userId: ${userId}`);
      res.json(draft);
    } catch (error: any) {
      console.error(`[DraftController] Error in duplicateToDraft:`, error);
      res.status(500).json({ error: error.message, stack: error.stack });
    }
  }

  static async listCampaigns(req: Request, res: Response) {
    try {
      const { userId } = req as AuthRequest;
      console.log(`[DraftController] Listing campaigns for user: ${userId}`);
      const drafts = await DraftCampaignService.listByUser(userId!);
      console.log(`[DraftController] Found ${drafts.length} drafts`);
      res.json(drafts);
    } catch (error: any) {
      console.error(`[DraftController] Error in listCampaigns:`, error);
      res.status(500).json({ error: error.message, stack: error.stack });
    }
  }

  static async getCampaign(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const draft = await DraftCampaignService.getById(id);
      res.json(draft);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateCampaign(req: Request, res: Response) {
    const id = req.params.id as string;
    try {
      console.log(`[DraftController] Updating campaign: ${id}`, req.body);
      const draft = await DraftCampaignService.update(id, req.body);
      res.json(draft);
    } catch (error: any) {
      console.error(`[DraftController] Error updating campaign ${id}:`, error);
      res.status(500).json({ error: error.message });
    }
  }

  static async updateAdSet(req: Request, res: Response) {
    const id = req.params.id as string;
    try {
      console.log(`[DraftController] Updating adset: ${id}`, req.body);
      const draft = await DraftAdSetService.update(id, req.body);
      res.json(draft);
    } catch (error: any) {
      console.error(`[DraftController] Error updating adset ${id}:`, error);
      res.status(500).json({ error: error.message });
    }
  }

  static async updateAd(req: Request, res: Response) {
    const id = req.params.id as string;
    try {
      console.log(`[DraftController] Updating ad: ${id}`, req.body);
      const draft = await DraftAdService.update(id, req.body);
      res.json(draft);
    } catch (error: any) {
      console.error(`[DraftController] Error updating ad ${id}:`, error);
      res.status(500).json({ error: error.message });
    }
  }

  static async validateDraft(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const draft = await DraftCampaignService.getById(id);
      if (!draft) return res.status(404).json({ error: 'Draft not found' });

      const validation = await DraftValidationEngine.validateFullDraft(draft);
      
      // Save validation results back to DB
      await DraftCampaignService.update(id, { 
        validationErrors: validation.campaignErrors,
        status: validation.isValid ? 'READY' : 'VALIDATION_FAILED'
      });

      for (const adSetId in validation.adSetErrors) {
        await DraftAdSetService.update(adSetId, { validationErrors: validation.adSetErrors[adSetId] });
      }

      for (const adId in validation.adErrors) {
        await DraftAdService.update(adId, { validationErrors: validation.adErrors[adId] });
      }

      res.json(validation);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async publishDraft(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { userId } = req as AuthRequest;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.accessToken) {
        return res.status(401).json({ error: 'Unauthorized: Missing Facebook access token' });
      }

      const result = await DraftPublishService.publishCampaign(id, user.accessToken);
      res.json(result);
    } catch (error: any) {
      console.error(`[DraftController] Error in publishDraft:`, error);
      if (isFacebookAuthError(error.message)) {
        return res.status(401).json({ error: error.message, code: 'TOKEN_EXPIRED' });
      }
      res.status(500).json({ error: error.message });
    }
  }

  static async bulkPublishDrafts(req: Request, res: Response) {
    try {
      const { campaignIds } = req.body as { campaignIds: string[] };
      const { userId } = req as AuthRequest;

      if (!Array.isArray(campaignIds) || campaignIds.length === 0) {
        return res.status(400).json({ error: 'campaignIds must be a non-empty array' });
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.accessToken) {
        return res.status(401).json({ error: 'Unauthorized: Missing Facebook access token' });
      }

      const results: { id: string; success: boolean; metaCampaignId?: string; error?: string }[] = [];
      for (const id of campaignIds) {
        try {
          const result = await DraftPublishService.publishCampaign(id, user.accessToken);
          results.push({ id, success: true, metaCampaignId: result.metaCampaignId });
        } catch (error: any) {
          // Stop the entire batch if the token is expired — no point trying the rest
          if (isFacebookAuthError(error.message)) {
            return res.status(401).json({ error: error.message, code: 'TOKEN_EXPIRED' });
          }
          results.push({ id, success: false, error: error.message });
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
      await DraftCampaignService.delete(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async bulkDeleteDrafts(req: Request, res: Response) {
    try {
      const { campaignIds } = req.body as { campaignIds: string[] };
      const { userId } = req as AuthRequest;

      if (!Array.isArray(campaignIds) || campaignIds.length === 0) {
        return res.status(400).json({ error: 'campaignIds must be a non-empty array' });
      }

      // Only delete campaigns that belong to this user and are not currently PUBLISHING
      const deleted = await prisma.draftCampaign.deleteMany({
        where: {
          id: { in: campaignIds },
          userId,
          status: { not: 'PUBLISHING' },
        },
      });

      res.json({ deleted: deleted.count });
    } catch (error: any) {
      console.error(`[DraftController] Error in bulkDeleteDrafts:`, error);
      res.status(500).json({ error: error.message });
    }
  }
}
