import type { Request, Response } from 'express';
import { db } from '../config/db';
import { getWebhookQueue } from '../queues/webhookQueue';

const withTimeout = <T>(promise: Promise<T>, ms = 2000): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);

const check = async (fn: () => Promise<unknown>): Promise<'up' | 'down'> => {
  try {
    await withTimeout(fn());
    return 'up';
  } catch {
    return 'down';
  }
};

export const healthController = {
  async check(_req: Request, res: Response) {
    const [database, redis] = await Promise.all([
      check(() => db.raw('select 1')),
      check(async () => ((await getWebhookQueue().client) as unknown as { ping(): Promise<string> }).ping()),
    ]);
    const healthy = database === 'up' && redis === 'up';
    // Only up/down is exposed: no hosts, credentials or error text.
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      uptimeSeconds: Math.round(process.uptime()),
      checks: { database, redis },
    });
  },
};
