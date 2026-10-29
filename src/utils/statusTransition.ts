import type { MessagePatch, MessageStatus, ProviderStatus } from '../types';

/**
 * STATUS TRANSITION RULES
 *
 *   QUEUED -> SENT -> DELIVERED -> READ      (forward only, by rank)
 *   QUEUED | SENT -> FAILED                  (delivery failure)
 *
 *  - A status may only move to a strictly higher rank. Equal/lower rank = stale, ignored.
 *  - Skipping ahead is allowed (DELIVERED may arrive before SENT: out-of-order delivery).
 *  - FAILED is terminal. Once FAILED, nothing changes the message.
 *  - FAILED is NOT accepted after DELIVERED/READ (the message already reached the user).
 *  - Ignored-but-valid events still back-fill their own timestamp if it is empty
 *    (a late SENT after DELIVERED still tells us when it was sent).
 */
export type TransitionDecision = 'APPLY' | 'IGNORE_STALE' | 'IGNORE_TERMINAL';

const RANK: Record<Exclude<MessageStatus, 'FAILED'>, number> = {
  QUEUED: 0,
  SENT: 1,
  DELIVERED: 2,
  READ: 3,
};

export const decideTransition = (
  current: MessageStatus,
  incoming: ProviderStatus,
): TransitionDecision => {
  if (current === 'FAILED') return 'IGNORE_TERMINAL';
  if (incoming === 'FAILED') {
    return current === 'QUEUED' || current === 'SENT' ? 'APPLY' : 'IGNORE_STALE';
  }
  return RANK[incoming] > RANK[current] ? 'APPLY' : 'IGNORE_STALE';
};

const TIMESTAMP_FIELD = {
  SENT: 'sentAt',
  DELIVERED: 'deliveredAt',
  READ: 'readAt',
  FAILED: 'failedAt',
} as const;

interface MessageSnapshot {
  status: MessageStatus;
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  failedAt: Date | null;
}

export const buildMessageUpdate = (
  message: MessageSnapshot,
  event: { status: ProviderStatus; occurredAt: Date },
): { decision: TransitionDecision; patch: MessagePatch } => {
  const decision = decideTransition(message.status, event.status);
  const patch: MessagePatch = {};
  if (decision === 'IGNORE_TERMINAL') return { decision, patch };

  const field = TIMESTAMP_FIELD[event.status];
  if (decision === 'APPLY') {
    patch.status = event.status;
    patch[field] = event.occurredAt;
  } else if (event.status !== 'FAILED' && message[field] === null) {
    patch[field] = event.occurredAt; // back-fill only
  }
  return { decision, patch };
};
