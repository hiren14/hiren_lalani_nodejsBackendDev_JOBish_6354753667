import { webhookService } from '../../src/services/webhook.service';
import { messageRepository } from '../../src/repositories/message.repository';
import { webhookEventRepository } from '../../src/repositories/webhookEvent.repository';
import { enqueueWebhookEvent } from '../../src/queues/webhookQueue';

jest.mock('../../src/config/db', () => ({
  db: { transaction: (fn: (trx: object) => unknown) => fn({}) },
}));
jest.mock('../../src/queues/webhookQueue', () => ({ enqueueWebhookEvent: jest.fn() }));
jest.mock('../../src/repositories/message.repository', () => ({
  messageRepository: { findById: jest.fn(), findByIdForUpdate: jest.fn(), applyPatch: jest.fn() },
}));
jest.mock('../../src/repositories/webhookEvent.repository', () => ({
  webhookEventRepository: {
    insertIfAbsent: jest.fn(),
    findById: jest.fn(),
    findByIdForUpdate: jest.fn(),
    setState: jest.fn(),
  },
}));

const msgRepo = messageRepository as jest.Mocked<typeof messageRepository>;
const evtRepo = webhookEventRepository as jest.Mocked<typeof webhookEventRepository>;
const enqueue = enqueueWebhookEvent as jest.Mock;

const payload = {
  eventId: 'evt-1',
  messageId: 'msg_1',
  status: 'DELIVERED' as const,
  occurredAt: new Date('2026-10-16T08:30:00.000Z'),
};
const message = {
  id: 'msg_1', status: 'SENT', sentAt: null, deliveredAt: null, readAt: null, failedAt: null,
} as never;
const storedEvent = (over = {}) => ({ ...payload, receivedAt: new Date(), processingState: 'PENDING', outcome: null, attempts: 0, ...over }) as never;

describe('webhookService.ingest', () => {
  it('stores then enqueues a new event', async () => {
    msgRepo.findById.mockResolvedValue(message);
    evtRepo.insertIfAbsent.mockResolvedValue(storedEvent());
    const res = await webhookService.ingest(payload);
    expect(res).toEqual({ eventId: 'evt-1', duplicate: false, processingState: 'PENDING' });
    expect(enqueue).toHaveBeenCalledWith('evt-1');
  });

  it('duplicate eventId is acknowledged without re-enqueueing a processed event', async () => {
    msgRepo.findById.mockResolvedValue(message);
    evtRepo.insertIfAbsent.mockResolvedValue(null);
    evtRepo.findById.mockResolvedValue(storedEvent({ processingState: 'APPLIED' }));
    const res = await webhookService.ingest(payload);
    expect(res.duplicate).toBe(true);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('duplicate of a still-PENDING event is re-enqueued (crash recovery)', async () => {
    msgRepo.findById.mockResolvedValue(message);
    evtRepo.insertIfAbsent.mockResolvedValue(null);
    evtRepo.findById.mockResolvedValue(storedEvent());
    await webhookService.ingest(payload);
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it('unknown messageId -> 404 and nothing stored', async () => {
    msgRepo.findById.mockResolvedValue(null);
    await expect(webhookService.ingest(payload)).rejects.toMatchObject({ statusCode: 404 });
    expect(evtRepo.insertIfAbsent).not.toHaveBeenCalled();
  });

  it('same eventId for a different message -> 409', async () => {
    msgRepo.findById.mockResolvedValue(message);
    evtRepo.insertIfAbsent.mockResolvedValue(null);
    evtRepo.findById.mockResolvedValue(storedEvent({ messageId: 'msg_other' }));
    await expect(webhookService.ingest(payload)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('queue failure -> 503 (event stays PENDING for provider retry)', async () => {
    msgRepo.findById.mockResolvedValue(message);
    evtRepo.insertIfAbsent.mockResolvedValue(storedEvent());
    enqueue.mockRejectedValueOnce(new Error('redis down'));
    await expect(webhookService.ingest(payload)).rejects.toMatchObject({ statusCode: 503 });
  });
});

describe('webhookService.processEvent', () => {
  it('applies a forward transition', async () => {
    evtRepo.findByIdForUpdate.mockResolvedValue(storedEvent());
    msgRepo.findByIdForUpdate.mockResolvedValue(message);
    await webhookService.processEvent('evt-1');
    expect(msgRepo.applyPatch).toHaveBeenCalledWith(
      'msg_1',
      { status: 'DELIVERED', deliveredAt: payload.occurredAt },
      expect.anything(),
    );
    expect(evtRepo.setState).toHaveBeenCalledWith('evt-1', 'APPLIED', expect.any(String), expect.anything());
  });

  it('out-of-order older event does not move the message backwards', async () => {
    evtRepo.findByIdForUpdate.mockResolvedValue(storedEvent({ status: 'SENT' }));
    msgRepo.findByIdForUpdate.mockResolvedValue({ ...(message as object), status: 'READ', readAt: new Date() } as never);
    await webhookService.processEvent('evt-1');
    const patch = msgRepo.applyPatch.mock.calls[0][1];
    expect(patch.status).toBeUndefined();
    expect(evtRepo.setState).toHaveBeenCalledWith('evt-1', 'IGNORED', expect.stringContaining('stale'), expect.anything());
  });

  it('skips events that were already processed (idempotent redelivery)', async () => {
    evtRepo.findByIdForUpdate.mockResolvedValue(storedEvent({ processingState: 'APPLIED' }));
    await webhookService.processEvent('evt-1');
    expect(msgRepo.applyPatch).not.toHaveBeenCalled();
  });
});
