import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { AiCampaignService, ChatMessage } from '../services/AiCampaignService';

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

      res.json(result);
    } catch (error: any) {
      console.error('[AiCreate] Unhandled error:', error.message);
      res.status(500).json({ error: error.message });
    }
  }
}
