import pino from 'pino';
import { env } from './env';

/**
 * Logging policy:
 *  - Message text is never logged (only its length).
 *  - Phone numbers / emails are logged only through utils/mask.
 *  - `redact` is a safety net in case someone logs a raw object by mistake.
 */
export const logger = pino({
  level: env.logLevel,
  base: { service: 'messaging-api' },
  // Text level + ISO time: Dozzle (and other log viewers) colour/filter by these.
  formatters: { level: (label) => ({ level: label }) },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.apiKey',
      '*.accessToken',
      '*.token',
      '*.text',
      '*.to',
      '*.email',
      'password',
      'apiKey',
      'token',
      'text',
      'to',
      'email',
    ],
    censor: '[REDACTED]',
  },
});