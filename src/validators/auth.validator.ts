import Joi from 'joi';

const tenantId = Joi.string().trim().min(1).max(64).pattern(/^[A-Za-z0-9_.-]+$/);

export const registerSchema = Joi.object({
  tenantId: tenantId.required(),
  email: Joi.string().trim().email({ tlds: { allow: false } }).max(254).required(),
  // 72 = bcrypt's effective input limit
  password: Joi.string().min(8).max(72).required(),
});

export const loginSchema = Joi.object({
  email: Joi.string().trim().email({ tlds: { allow: false } }).max(254).required(),
  password: Joi.string().min(1).max(72).required(),
});

export const providerTokenSchema = Joi.object({
  apiKey: Joi.string().min(1).max(256).required(),
});
