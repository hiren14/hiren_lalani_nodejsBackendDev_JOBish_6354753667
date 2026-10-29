import { db } from '../config/db';
import { logger } from '../config/logger';
import { enqueueWebhookEvent } from '../queues/webhookQueue';
import { messageRepository } from '../repositories/message.repository';
import { webhookEventRepository } from '../repositories/webhookEvent.repository';
import type { EventState, WebhookPayload } from '../types';
import { ApiError } from '../utils/ApiError';
import { buildMessageUpdate } from '../utils/statusTransition';

export interface IngestResult {
  eventId: string;
  duplicate: boolean;
  processingState: EventState;
}

const enqueueOrFail = async (eventId: string): Promise<void> => {
  try {
    await enqueueWebhookEvent(eventId);
  } catch (err) {
    logger.error({ err, eventId }, 'failed to enqueue webhook event');
    // Event is already stored as PENDING; the provider's retry will re-enqueue it.
    throw new ApiError(503, 'QUEUE_UNAVAILABLE', 'Temporarily unable to process event, retry later');
  }
};

export const webhookService = {
  /**
   * HTTP side: validate -> persist event -> enqueue -> acknowledge.
   * The event row is committed BEFORE we answer, so an acknowledged event is never lost.
   */
  async ingest(payload: WebhookPayload): Promise<IngestResult> {
    // Unknown message: explicit 404 (documented strategy). Nothing is stored.
    const message = await messageRepository.findById(payload.messageId);
    if (!message) {
      throw new ApiError(404, 'MESSAGE_NOT_FOUND', 'Unknown messageId');
    }

    const inserted = await webhookEventRepository.insertIfAbsent(payload);

    if (!inserted) {
      const existing = await webhookEventRepository.findById(payload.eventId);
      if (existing && existing.messageId !== payload.messageId) {
        throw new ApiError(409, 'EVENT_ID_CONFLICT', 'eventId was already used for another message');
      }
      // Crash recovery: a previous attempt stored the event but failed to enqueue it.
      // jobId = eventId makes this re-enqueue safe.
      if (existing?.processingState === 'PENDING') {
        await enqueueOrFail(payload.eventId);
      }
      logger.info({ eventId: payload.eventId }, 'duplicate webhook event ignored');
      return {
        eventId: payload.eventId,
        duplicate: true,
        processingState: existing?.processingState ?? 'PENDING',
      };
    }

    await enqueueOrFail(payload.eventId);
    logger.info(
      { eventId: payload.eventId, messageId: payload.messageId, status: payload.status },
      'webhook event accepted',
    );
    return { eventId: payload.eventId, duplicate: false, processingState: 'PENDING' };
  },

  /** Worker side. Idempotent: a processed event is skipped on redelivery. */
  async processEvent(eventId: string): Promise<string> {
    return db.transaction(async (trx) => {
      const event = await webhookEventRepository.findByIdForUpdate(eventId, trx);
      if (!event) throw new Error(`event ${eventId} not found`);
      if (event.processingState !== 'PENDING') return 'already-processed';

      const message = await messageRepository.findByIdForUpdate(event.messageId, trx);
      if (!message) throw new Error(`message for event ${eventId} not found`);

      const { decision, patch } = buildMessageUpdate(message, event);
      await messageRepository.applyPatch(message.id, patch, trx);

      const state: EventState = decision === 'APPLY' ? 'APPLIED' : 'IGNORED';
      const outcome =
        decision === 'APPLY'
          ? `applied ${message.status}->${event.status}`
          : decision === 'IGNORE_TERMINAL'
            ? `ignored: message already ${message.status} (terminal)`
            : `ignored: stale ${event.status} while message is ${message.status}`;
      await webhookEventRepository.setState(eventId, state, outcome, trx);

      logger.info({ eventId, messageId: message.id, state, outcome }, 'webhook event processed');
      return outcome;
    });
  },

  /** Called by the worker once all retries are used up. */
  async markFailed(eventId: string, reason: string, attempts: number): Promise<void> {
    await webhookEventRepository.setState(eventId, 'FAILED', `failed: ${reason}`.slice(0, 500), db, attempts);
  },
};
