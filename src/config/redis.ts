import IORedis from 'ioredis';
import { env } from './env';

/** Producer connection: fail fast so the API can answer 503 instead of hanging. */
export const createQueueConnection = () =>
  new IORedis(env.redisUrl, { maxRetriesPerRequest: 1, enableOfflineQueue: false });

/** BullMQ workers require maxRetriesPerRequest = null (blocking commands). */
export const createWorkerConnection = () => new IORedis(env.redisUrl, { maxRetriesPerRequest: null });
