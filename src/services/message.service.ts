import { logger } from '../config/logger';
import { messageRepository } from '../repositories/message.repository';
import type { CreateMessageInput, Message } from '../types';
import { ApiError } from '../utils/ApiError';
import { decodeCursor, encodeCursor } from '../utils/cursor';
import { newMessageId } from '../utils/id';
import { maskPhone } from '../utils/mask';

export const toMessageDto = (m: Message) => ({
  id: m.id,
  tenantId: m.tenantId,
  conversationId: m.conversationId,
  to: m.to,
  text: m.text,
  status: m.status,
  timestamps: {
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    sentAt: m.sentAt,
    deliveredAt: m.deliveredAt,
    readAt: m.readAt,
    failedAt: m.failedAt,
  },
});

export const messageService = {
  async create(tenantId: string, input: CreateMessageInput) {
    // Tenant comes from the JWT. A body that names another tenant is rejected, not trusted.
    if (input.tenantId !== tenantId) {
      throw new ApiError(403, 'TENANT_MISMATCH', 'tenantId does not match the authenticated tenant');
    }
    const message = await messageRepository.create({
      id: newMessageId(),
      tenantId,
      conversationId: input.conversationId,
      to: input.to,
      text: input.text,
    });
    // PII policy: phone masked, text never logged (length only).
    logger.info(
      {
        messageId: message.id,
        tenantId,
        conversationId: message.conversationId,
        toMasked: maskPhone(message.to),
        textLength: message.text.length,
      },
      'message created',
    );
    return toMessageDto(message);
  },

  async getById(tenantId: string, messageId: string) {
    const message = await messageRepository.findByIdForTenant(messageId, tenantId);
    if (!message) throw new ApiError(404, 'MESSAGE_NOT_FOUND', 'Message not found');
    return toMessageDto(message);
  },

  async listByConversation(
    tenantId: string,
    conversationId: string,
    limit: number,
    cursor?: string,
  ) {
    const afterSeq = cursor ? decodeCursor(cursor) : undefined;
    // Fetch one extra row to know whether another page exists.
    const rows = await messageRepository.listByConversation(
      tenantId,
      conversationId,
      limit + 1,
      afterSeq,
    );
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      data: page.map(toMessageDto),
      pagination: {
        limit,
        hasMore,
        nextCursor: hasMore ? encodeCursor(page[page.length - 1].seq) : null,
      },
    };
  },
};
