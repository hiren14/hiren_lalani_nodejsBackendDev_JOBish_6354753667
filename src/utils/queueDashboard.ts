import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import type { Router } from 'express';
import { getDeadLetterQueue, getWebhookQueue } from '../queues/webhookQueue';

/** Web UI for BullMQ: jobs, retries/backoff state, failed jobs and the dead-letter queue. */
export const createQueueDashboard = (basePath: string): Router => {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(basePath);
  createBullBoard({
    queues: [new BullMQAdapter(getWebhookQueue()), new BullMQAdapter(getDeadLetterQueue())],
    serverAdapter,
  });
  return serverAdapter.getRouter() as Router;
};