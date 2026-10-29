import type { Knex } from 'knex';
import { db } from '../config/db';
import type { Message, MessagePatch, MessageStatus } from '../types';

interface MessageRow {
  id: string;
  seq: string | number;
  tenant_id: string;
  conversation_id: string;
  recipient: string;
  text: string;
  status: MessageStatus;
  sent_at: Date | null;
  delivered_at: Date | null;
  read_at: Date | null;
  failed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const toMessage = (r: MessageRow): Message => ({
  id: r.id,
  seq: Number(r.seq), // bigint comes back from pg as string
  tenantId: r.tenant_id,
  conversationId: r.conversation_id,
  to: r.recipient,
  text: r.text,
  status: r.status,
  sentAt: r.sent_at,
  deliveredAt: r.delivered_at,
  readAt: r.read_at,
  failedAt: r.failed_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export interface NewMessage {
  id: string;
  tenantId: string;
  conversationId: string;
  to: string;
  text: string;
}

export const messageRepository = {
  async create(input: NewMessage): Promise<Message> {
    const [row] = await db('messages')
      .insert({
        id: input.id,
        tenant_id: input.tenantId,
        conversation_id: input.conversationId,
        recipient: input.to,
        text: input.text,
        status: 'QUEUED',
      })
      .returning('*');
    return toMessage(row as MessageRow);
  },

  async findById(id: string): Promise<Message | null> {
    const row = await db('messages').where({ id }).first();
    return row ? toMessage(row as MessageRow) : null;
  },

  /** Tenant-scoped lookup: a message of another tenant looks exactly like "not found". */
  async findByIdForTenant(id: string, tenantId: string): Promise<Message | null> {
    const row = await db('messages').where({ id, tenant_id: tenantId }).first();
    return row ? toMessage(row as MessageRow) : null;
  },

  /** Row lock so concurrent status updates for the same message are serialised. */
  async findByIdForUpdate(id: string, trx: Knex.Transaction): Promise<Message | null> {
    const row = await trx('messages').where({ id }).forUpdate().first();
    return row ? toMessage(row as MessageRow) : null;
  },

  async listByConversation(
    tenantId: string,
    conversationId: string,
    limit: number,
    afterSeq?: number,
  ): Promise<Message[]> {
    const query = db('messages')
      .where({ tenant_id: tenantId, conversation_id: conversationId })
      .orderBy('seq', 'asc')
      .limit(limit);
    if (afterSeq !== undefined) query.andWhere('seq', '>', afterSeq);
    const rows = await query;
    return (rows as MessageRow[]).map(toMessage);
  },

  async applyPatch(id: string, patch: MessagePatch, trx: Knex.Transaction): Promise<void> {
    if (Object.keys(patch).length === 0) return;
    await trx('messages')
      .where({ id })
      .update({
        ...(patch.status && { status: patch.status }),
        ...(patch.sentAt && { sent_at: patch.sentAt }),
        ...(patch.deliveredAt && { delivered_at: patch.deliveredAt }),
        ...(patch.readAt && { read_at: patch.readAt }),
        ...(patch.failedAt && { failed_at: patch.failedAt }),
        updated_at: trx.fn.now(),
      });
  },
};
