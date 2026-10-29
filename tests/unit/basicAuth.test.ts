import express from 'express';
import request from 'supertest';
import { basicAuth } from '../../src/middlewares/basicAuth';

const app = express();
app.use('/admin', basicAuth('admin', 'dashboard-pass-123'), (_req, res) => res.send('dashboard'));

describe('basicAuth (protects /admin/queues)', () => {
  it('401 + challenge without credentials', async () => {
    const res = await request(app).get('/admin');
    expect(res.status).toBe(401);
    expect(res.headers['www-authenticate']).toContain('Basic');
  });
  it('401 with a wrong password', async () => {
    expect((await request(app).get('/admin').auth('admin', 'wrong-password')).status).toBe(401);
  });
  it('200 with the right credentials', async () => {
    const res = await request(app).get('/admin').auth('admin', 'dashboard-pass-123');
    expect(res.status).toBe(200);
  });
});