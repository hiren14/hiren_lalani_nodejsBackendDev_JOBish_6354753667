import { Worker } from 'bullmq';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { createWorkerConnection } from '../config/redis';
import { getDeadLetterQueue, WEBHOOK_QUEUE, type WebhookJobData } from '../queues/webhookQueue';
import { webhookService } from '../services/webhook.service';

export const startWebhookWorker = (): Worker<WebhookJobData> => {
  const worker = new Worker<WebhookJobData>(
    WEBHOOK_QUEUE,
    async (job) => {
      await webhookService.processEvent(job.data.eventId);
    },
    { connection: createWorkerConnection(), concurrency: env.workerConcurrency },
  );

  worker.on('completed', (job) => {
    logger.debug({ jobId: job.id, eventId: job.data.eventId }, 'job completed');
  });

  worker.on('failed', async (job, err) => {
    if (!job) return;
    const maxAttempts = job.opts.attempts ?? 1;
    const exhausted = job.attemptsMade >= maxAttempts;
    logger.warn(
      { jobId: job.id, eventId: job.data.eventId, attempt: job.attemptsMade, maxAttempts, err: err.message },
      exhausted ? 'job failed permanently' : 'job failed, will retry with backoff',
    );
    if (!exhausted) return;
    try {
      // Dead-letter strategy: mark in DB + park in a DLQ queue for manual replay.
      await webhookService.markFailed(job.data.eventId, err.message, job.attemptsMade);
      await getDeadLetterQueue().add('dead-event', {
        eventId: job.data.eventId,
        reason: err.message.slice(0, 500),
        attempts: job.attemptsMade,
        failedAt: new Date().toISOString(),
      });
    } catch (dlqErr) {
      logger.error({ err: dlqErr, eventId: job.data.eventId }, 'failed to dead-letter event');
    }
  });

  worker.on('error', (err) => logger.error({ err }, 'worker error'));
  return worker;
};
