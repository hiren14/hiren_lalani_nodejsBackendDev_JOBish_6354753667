import request from 'supertest';
import { createApp } from '../../src/app';
import { signToken } from '../../src/utils/jwt';
import { messageRepository } from '../../src/repositories/message.repository';

jest.mock('../../src/repositories/message.repository', () => ({
  messageRepository: {
    create: jest.fn(),
    findByIdForTenant: jest.fn(),
    listByConversation: jest.fn(),
  },
}));
jest.mock('../../src/queues/webhookQueue', () => ({
  enqueueWebhookEvent: jest.fn(),
  getWebhookQueue: jest.fn(),
}));

const repo = messageRepository as jest.Mocked<typeof messageRepository>;
const app = createApp();
const userToken = signToken({ sub: 'u1', role: 'user', tenantId: 'tenant-a' });
const providerToken = signToken({ sub: 'provider', role: 'provider' });
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

const valid = { tenantId: 'tenant-a', conversationId: 'conv-100', to: '+919876543210', text: 'Your order has shipped' };
const row = (seq: number) => ({
  id: `msg_${seq}`, seq, tenantId: 'tenant-a', conversationId: 'conv-100', to: valid.to, text: 'hi',
  status: 'QUEUED', sentAt: null, deliveredAt: null, readAt: null, failedAt: null,
  createdAt: new Date(), updatedAt: new Date(),
});

describe('auth guard', () => {
  it('401 without token on every protected route', async () => {
    expect((await request(app).post('/api/v1/messages').send(valid)).status).toBe(401);
    expect((await request(app).get('/api/v1/messages/msg_1')).status).toBe(401);
    expect((await request(app).get('/api/v1/conversations/c/messages')).status).toBe(401);
    expect((await request(app).post('/api/v1/webhooks/provider').send({})).status).toBe(401);
  });

  it('403 when a user token calls the provider webhook', async () => {
    const res = await request(app).post('/api/v1/webhooks/provider').set(auth(userToken)).send({});
    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/messages', () => {
  it('creates a QUEUED message', async () => {
    repo.create.mockResolvedValue(row(1) as never);
    const res = await request(app).post('/api/v1/messages').set(auth(userToken)).send(valid);
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('QUEUED');
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-a' }));
  });

  it('400 with field details for an invalid payload', async () => {
    const res = await request(app).post('/api/v1/messages').set(auth(userToken)).send({ ...valid, to: '12345', text: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.length).toBeGreaterThanOrEqual(2);
  });

  it('400 for malformed JSON (not a 500)', async () => {
    const res = await request(app).post('/api/v1/messages').set(auth(userToken)).set('Content-Type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
  });

  it('403 when body tenantId differs from the token tenant (tenant isolation)', async () => {
    const res = await request(app).post('/api/v1/messages').set(auth(userToken)).send({ ...valid, tenantId: 'tenant-b' });
    expect(res.status).toBe(403);
    expect(repo.create).not.toHaveBeenCalled();
  });
});

describe('GET conversation messages', () => {
  it('paginates with a stable cursor and always scopes by token tenant', async () => {
    repo.listByConversation.mockResolvedValue([row(1), row(2), row(3)] as never);
    const res = await request(app).get('/api/v1/conversations/conv-100/messages?limit=2').set(auth(userToken));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.hasMore).toBe(true);
    expect(repo.listByConversation).toHaveBeenCalledWith('tenant-a', 'conv-100', 3, undefined);

    repo.listByConversation.mockResolvedValue([row(3)] as never);
    const next = await request(app)
      .get(`/api/v1/conversations/conv-100/messages?limit=2&cursor=${res.body.pagination.nextCursor}`)
      .set(auth(userToken));
    expect(repo.listByConversation).toHaveBeenLastCalledWith('tenant-a', 'conv-100', 3, 2);
    expect(next.body.pagination.hasMore).toBe(false);
  });

  it('400 for a garbage cursor', async () => {
    const res = await request(app).get('/api/v1/conversations/c/messages?cursor=abc').set(auth(userToken));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/messages/:id', () => {
  it('404 when the message is not visible to the tenant', async () => {
    repo.findByIdForTenant.mockResolvedValue(null);
    const res = await request(app).get('/api/v1/messages/msg_x').set(auth(userToken));
    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/webhooks/provider validation', () => {
  it('400 for an invalid status', async () => {
    const res = await request(app).post('/api/v1/webhooks/provider').set(auth(providerToken))
      .send({ eventId: 'evt-1', messageId: 'msg_1', status: 'WHATEVER', occurredAt: '2026-10-16T08:30:00.000Z' });
    expect(res.status).toBe(400);
  });
});

describe('docs', () => {
  it('serves the OpenAPI document', async () => {
    const res = await request(app).get('/docs.json');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.paths)).toContain('/api/v1/webhooks/provider');
  });
});
