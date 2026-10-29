import type { RequestHandler } from 'express';
import type Joi from 'joi';
import { ApiError } from '../utils/ApiError';

interface Schemas {
  params?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  body?: Joi.ObjectSchema;
}

export const validate =
  (schemas: Schemas): RequestHandler =>
  (req, _res, next) => {
    const details: { field: string; message: string }[] = [];

    for (const key of ['params', 'query', 'body'] as const) {
      const schema = schemas[key];
      if (!schema) continue;
      const { value, error } = schema.validate(req[key], {
        abortEarly: false,
        stripUnknown: true,
        convert: true,
      });
      if (error) {
        details.push(
          ...error.details.map((d) => ({
            field: `${key}.${d.path.join('.')}`,
            message: d.message.replace(/"/g, ''),
          })),
        );
      } else {
        req[key] = value;
      }
    }

    if (details.length) {
      return next(new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed', details));
    }
    next();
  };
