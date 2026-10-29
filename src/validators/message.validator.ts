import Joi from 'joi';

export const createMessageSchema = Joi.object({
  tenantId: Joi.string().trim().min(1).max(64).required(),
  conversationId: Joi.string().trim().min(1).max(128).required(),
  // E.164: + followed by 8-15 digits
  to: Joi.string().pattern(/^\+[1-9]\d{7,14}$/).required().messages({
    'string.pattern.base': 'to must be a phone number in E.164 format, e.g. +919876543210',
  }),
  text: Joi.string().min(1).max(4096).required(),
});

export const messageIdParamSchema = Joi.object({
  messageId: Joi.string().trim().min(1).max(64).required(),
});

export const listMessagesParamsSchema = Joi.object({
  conversationId: Joi.string().trim().min(1).max(128).required(),
});

export const listMessagesQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
  cursor: Joi.string().max(128),
});
