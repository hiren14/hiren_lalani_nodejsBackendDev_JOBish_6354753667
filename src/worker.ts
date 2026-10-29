import { db } from './config/db';
import { logger } from './config/logger';
import { closeQueues } from './queues/webhookQueue';
import { startWebhookWorker } from './workers/webhookWorker';

const worker = startWebhookWorker();
logger.info('webhook worker started');

const shutdown = async (signal: string) => {
  logger.info({ signal }, 'worker shutting down');
  await worker.close(); // waits for in-flight jobs
  await closeQueues().catch(() => undefined);
  await db.destroy().catch(() => undefined);
  process.exit(0);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
