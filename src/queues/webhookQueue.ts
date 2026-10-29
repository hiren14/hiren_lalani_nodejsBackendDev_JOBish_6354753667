import { Queue } from 'bullmq';
import { env } from '../config/env';
import { createQueueConnection } from '../config/redis';

export const WEBHOOK_QUEUE = 'webhook-events';
export const DEAD_LETTER_QUEUE = 'webhook-events-dlq';

export interface WebhookJobData {
  eventId: string;
}

export interface DeadLetterJobData {
  eventId: string;
  reason: string;
  attempts: number;
  failedAt: string;
}

// Created lazily so importing the app (e.g. in tests) never opens a Redis connection.
let webhookQueue: Queue<WebhookJobData> | undefined;
let deadLetterQueue: Queue<DeadLetterJobData> | undefined;

export const getWebhookQueue = (): Queue<WebhookJobData> => {
  webhookQueue ??= new Queue<WebhookJobData>(WEBHOOK_QUEUE, {
    connection: createQueueConnection(),
    defaultJobOptions: {
      attempts: env.jobAttempts,
      backoff: { type: 'exponential', delay: env.jobBackoffMs },
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: false, // failed jobs stay inspectable
    },
  });
  return webhookQueue;
};

export const getDeadLetterQueue = (): Queue<DeadLetterJobData> => {
  deadLetterQueue ??= new Queue<DeadLetterJobData>(DEAD_LETTER_QUEUE, {
    connection: createQueueConnection(),
  });
  return deadLetterQueue;
};

/** jobId = event id, so enqueueing the same event twice never creates two jobs. */
export const enqueueWebhookEvent = async (eventId: string): Promise<void> => {
  await getWebhookQueue().add('process-event', { eventId }, { jobId: `evt_${eventId}` });
};

export const closeQueues = async (): Promise<void> => {
  await Promise.all([webhookQueue?.close(), deadLetterQueue?.close()]);
};
