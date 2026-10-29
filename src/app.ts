import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { healthController } from './controllers/health.controller';
import { openApiSpec } from './docs/openapi';
import { env } from './config/env';
import { basicAuth } from './middlewares/basicAuth';
import { createQueueDashboard } from './utils/queueDashboard';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { requestLogger } from './middlewares/requestLogger';
import routes from './routes';
import { asyncHandler } from './utils/asyncHandler';

export const createApp = () => {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestLogger);

  // Swagger UI is mounted before helmet so its inline assets are not blocked by the CSP.
  app.get('/docs.json', (_req, res) => res.json(openApiSpec));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, { customSiteTitle: 'Messaging API Docs' }));

  // BullMQ web UI (Bull Board). Basic-auth protected, and only mounted if ADMIN_PASSWORD is set.
  if (env.adminPassword) {
    app.use('/admin/queues', basicAuth(env.adminUser, env.adminPassword), createQueueDashboard('/admin/queues'));
  }

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', asyncHandler(healthController.check));
  app.use('/api/v1', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};