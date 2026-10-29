import type { Knex } from 'knex';
import { db } from '../config/db';
import type { EventState, ProviderStatus, WebhookEvent } from '../types';

interface EventRow {
  event_id: string;
  message_id: string;
  status: ProviderStatus;
  occurred_at: Date;
  received_at: Date;
  processing_state: EventState;
  outcome: string | null;
  attempts: number;
}

const toEvent = (r: EventRow): WebhookEvent => ({
  eventId: r.event_id,
  messageId: r.message_id,
  status: r.status,
  occurredAt: r.occurred_at,
  receivedAt: r.received_at,
  processingState: r.processing_state,
  outcome: r.outcome,
  attempts: r.attempts,
});

export const webhookEventRepository = {
  /**
   * Atomic de-duplication: INSERT ... ON CONFLICT DO NOTHING on the event_id primary key.
   * Returns null when the event already existed (duplicate delivery).
   */
  async insertIfAbsent(input: {
    eventId: string;
    messageId: string;
    status: ProviderStatus;
    occurredAt: Date;
  }): Promise<WebhookEvent | null> {
    const rows = await db('webhook_events')
      .insert({
        event_id: input.eventId,
        message_id: input.messageId,
        status: input.status,
        occurred_at: input.occurredAt,
      })
      .onConflict('event_id')
      .ignore()
      .returning('*');
    return rows.length ? toEvent(rows[0] as EventRow) : null;
  },

  async findById(eventId: string): Promise<WebhookEvent | null> {
    const row = await db('webhook_events').where({ event_id: eventId }).first();
    return row ? toEvent(row as EventRow) : null;
  },

  async findByIdForUpdate(eventId: string, trx: Knex.Transaction): Promise<WebhookEvent | null> {
    const row = await trx('webhook_events').where({ event_id: eventId }).forUpdate().first();
    return row ? toEvent(row as EventRow) : null;
  },

  async setState(
    eventId: string,
    state: EventState,
    outcome: string,
    executor: Knex = db,
    attempts?: number,
  ): Promise<void> {
    await executor('webhook_events')
      .where({ event_id: eventId })
      .update({
        processing_state: state,
        outcome,
        processed_at: executor.fn.now(),
        ...(attempts !== undefined && { attempts }),
      });
  },
};
