import { buildMessageUpdate, decideTransition } from '../../src/utils/statusTransition';

const base = { status: 'QUEUED' as const, sentAt: null, deliveredAt: null, readAt: null, failedAt: null };
const at = new Date('2026-10-16T08:30:00.000Z');

describe('decideTransition', () => {
  it('moves forward', () => {
    expect(decideTransition('QUEUED', 'SENT')).toBe('APPLY');
    expect(decideTransition('SENT', 'DELIVERED')).toBe('APPLY');
    expect(decideTransition('DELIVERED', 'READ')).toBe('APPLY');
  });

  it('allows skipping ahead (out-of-order arrival)', () => {
    expect(decideTransition('QUEUED', 'DELIVERED')).toBe('APPLY');
  });

  it('never moves backwards or repeats', () => {
    expect(decideTransition('READ', 'SENT')).toBe('IGNORE_STALE');
    expect(decideTransition('READ', 'DELIVERED')).toBe('IGNORE_STALE');
    expect(decideTransition('DELIVERED', 'DELIVERED')).toBe('IGNORE_STALE');
  });

  it('FAILED only from QUEUED/SENT and is terminal', () => {
    expect(decideTransition('SENT', 'FAILED')).toBe('APPLY');
    expect(decideTransition('DELIVERED', 'FAILED')).toBe('IGNORE_STALE');
    expect(decideTransition('FAILED', 'DELIVERED')).toBe('IGNORE_TERMINAL');
  });
});

describe('buildMessageUpdate', () => {
  it('sets status and its timestamp when applying', () => {
    const { decision, patch } = buildMessageUpdate(base, { status: 'SENT', occurredAt: at });
    expect(decision).toBe('APPLY');
    expect(patch).toEqual({ status: 'SENT', sentAt: at });
  });

  it('late SENT after READ keeps status but back-fills sentAt', () => {
    const { decision, patch } = buildMessageUpdate(
      { ...base, status: 'READ', readAt: at },
      { status: 'SENT', occurredAt: at },
    );
    expect(decision).toBe('IGNORE_STALE');
    expect(patch).toEqual({ sentAt: at });
  });

  it('does not change anything once FAILED', () => {
    const { patch } = buildMessageUpdate({ ...base, status: 'FAILED' }, { status: 'READ', occurredAt: at });
    expect(patch).toEqual({});
  });
});
