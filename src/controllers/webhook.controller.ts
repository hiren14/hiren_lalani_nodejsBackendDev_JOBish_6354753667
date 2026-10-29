import type { Request, Response } from 'express';
import { webhookService } from '../services/webhook.service';

export const webhookController = {
  async handleProviderEvent(req: Request, res: Response) {
    const result = await webhookService.ingest(req.body);
    // 202: stored and queued. 200: duplicate delivery, nothing new done.
    res.status(result.duplicate ? 200 : 202).json({ success: true, data: result });
  },
};
