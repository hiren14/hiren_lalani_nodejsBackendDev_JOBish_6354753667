import { Router } from 'express';
import { webhookController } from '../controllers/webhook.controller';
import { authenticate } from '../middlewares/authenticate';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { webhookEventSchema } from '../validators/webhook.validator';

const router = Router();

router.post(
  '/webhooks/provider',
  authenticate('provider'),
  validate({ body: webhookEventSchema }),
  asyncHandler(webhookController.handleProviderEvent),
);

export default router;
