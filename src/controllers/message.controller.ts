import type { Request, Response } from 'express';
import { getTenantId } from '../middlewares/authenticate';
import { messageService } from '../services/message.service';

export const messageController = {
  async create(req: Request, res: Response) {
    const message = await messageService.create(getTenantId(req), req.body);
    res.status(201).json({ success: true, data: message });
  },

  async getById(req: Request, res: Response) {
    const message = await messageService.getById(getTenantId(req), req.params.messageId);
    res.status(200).json({ success: true, data: message });
  },

  async listByConversation(req: Request, res: Response) {
    const { limit, cursor } = req.query as unknown as { limit: number; cursor?: string };
    const result = await messageService.listByConversation(
      getTenantId(req),
      req.params.conversationId,
      limit,
      cursor,
    );
    res.status(200).json({ success: true, ...result });
  },
};
