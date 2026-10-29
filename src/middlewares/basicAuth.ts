import { createHash, timingSafeEqual } from 'crypto';
import type { RequestHandler } from 'express';

const digest = (v: string) => createHash('sha256').update(v).digest();
const same = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));

/** HTTP Basic auth for browser-only admin pages (a JWT header can't be sent from a plain page load). */
export const basicAuth =
  (user: string, password: string): RequestHandler =>
  (req, res, next) => {
    const header = req.headers.authorization ?? '';
    if (header.startsWith('Basic ')) {
      const [u = '', ...rest] = Buffer.from(header.slice(6), 'base64').toString('utf8').split(':');
      if (same(u, user) && same(rest.join(':'), password)) return next();
    }
    res.setHeader('WWW-Authenticate', 'Basic realm="Queue dashboard"');
    res.status(401).send('Authentication required');
  };