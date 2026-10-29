import Joi from 'joi';
import { PROVIDER_STATUSES } from '../types';

export const webhookEventSchema = Joi.object({
  // Restricted charset: also keeps the BullMQ job id safe.
  eventId: Joi.string().pattern(/^[A-Za-z0-9_.-]{1,128}$/).required(),
  messageId: Joi.string().trim().min(1).max(64).required(),
  status: Joi.string().valid(...PROVIDER_STATUSES).required(),
  occurredAt: Joi.date().iso().required(),
});
