import type { ErrorRequestHandler, RequestHandler } from 'express';
import { logger } from '../config/logger';
import { ApiError } from '../utils/ApiError';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new ApiError(404, 'ROUTE_NOT_FOUND', `Route ${req.method} ${req.path} not found`));
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
    return;
  }

  // body-parser errors: malformed JSON / payload too large
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ success: false, error: { code: 'INVALID_JSON', message: 'Malformed JSON body' } });
    return;
  }
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ success: false, error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body too large' } });
    return;
  }

  // Unknown error: log details server-side (with request id), return a generic body.
  logger.error({ err, requestId: (req as { id?: unknown }).id }, 'unhandled error');
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
  });
};
