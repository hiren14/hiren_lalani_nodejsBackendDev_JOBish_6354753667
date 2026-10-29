import { createApp } from './app';
import { db } from './config/db';
import { env } from './config/env';
import { logger } from './config/logger';
import { closeQueues } from './queues/webhookQueue';

const app = createApp();
const server = app.listen(env.port, () => {
  logger.info({ port: env.port, env: env.nodeEnv }, 'API listening (docs at /docs)');
});

const shutdown = (signal: string) => {
  logger.info({ signal }, 'shutting down');
  server.close(async () => {
    await closeQueues().catch(() => undefined);
    await db.destroy().catch(() => undefined);
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
