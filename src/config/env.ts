import 'dotenv/config';
import Joi from 'joi';

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .default('info'),
  DATABASE_URL: Joi.string().required(),
  REDIS_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default('1h'),
  PROVIDER_API_KEY: Joi.string().min(16).required(),
  ADMIN_USER: Joi.string().min(1).default('admin'),
  // Queue dashboard (/admin/queues) is only mounted when this is set
  ADMIN_PASSWORD: Joi.string().min(8).allow('').optional(),
  WORKER_CONCURRENCY: Joi.number().integer().min(1).default(5),
  JOB_ATTEMPTS: Joi.number().integer().min(1).default(5),
  JOB_BACKOFF_MS: Joi.number().integer().min(100).default(1000),
}).unknown(true);

const { value, error } = schema.validate(process.env, { abortEarly: false });

if (error) {
  // Only variable names are printed, never values.
  const keys = error.details.map((d) => d.path.join('.')).join(', ');
  throw new Error(`Invalid environment configuration: ${keys}`);
}

export const env = {
  nodeEnv: value.NODE_ENV as string,
  port: value.PORT as number,
  logLevel: value.LOG_LEVEL as string,
  databaseUrl: value.DATABASE_URL as string,
  redisUrl: value.REDIS_URL as string,
  jwtSecret: value.JWT_SECRET as string,
  jwtExpiresIn: value.JWT_EXPIRES_IN as string,
  providerApiKey: value.PROVIDER_API_KEY as string,
  adminUser: value.ADMIN_USER as string,
  adminPassword: (value.ADMIN_PASSWORD as string | undefined) || undefined,
  workerConcurrency: value.WORKER_CONCURRENCY as number,
  jobAttempts: value.JOB_ATTEMPTS as number,
  jobBackoffMs: value.JOB_BACKOFF_MS as number,
};