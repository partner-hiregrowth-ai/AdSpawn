import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { AiCampaignService, ChatMessage } from '../services/AiCampaignService';
import { prisma } from '../prisma';

export class AiCreateController {
  static async chat(req: AuthRequest, res: Response) {
    try {
      const { messages, adAccountId } = req.body as {
        messages: ChatMessage[];
        adAccountId: string;
      };

      const result = await AiCampaignService.chat({
        messages,
        adAccountId,
        profileId: req.profileId,
      });

      if (result.generationResult?.campaignIds?.length) {
        for (const campaignId of result.generationResult.campaignIds) {
          await prisma.duplicateJob.create({
            data: {
              userId: req.userId!,
              profileId: req.profileId || null,
              status: 'COMPLETED',
              type: 'CAMPAIGN',
              sourceId: adAccountId,
              targetId: campaignId,
              details: {
                operation: 'AI_CREATE',
                adAccountId,
                totalCreated: result.generationResult.totalCreated,
              },
            },
          });
        }
      }

      res.json(result);
    } catch (error: any) {
      console.error('[AiCreate] Unhandled error:', error.message);
      res.status(500).json({ error: error.message });
    }
  }
}
