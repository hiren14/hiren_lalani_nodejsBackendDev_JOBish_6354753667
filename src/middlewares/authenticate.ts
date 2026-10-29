import type { NextFunction, Request, Response } from 'express';
import '../types/auth';
import type { AuthContext, Role } from '../types';
import { ApiError } from '../utils/ApiError';
import { verifyToken } from '../utils/jwt';

/** Requires a valid Bearer JWT whose role is one of `roles`. */
export const authenticate =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    // Token can come from `Authorization: Bearer <jwt>` or the `x-provider-token` header
    // (used by the webhook so the token from /auth/provider-token can be pasted in Swagger).
    const header = req.headers.authorization;
    const providerHeader = req.headers['x-provider-token'];
    const token =
      header && header.startsWith('Bearer ')
        ? header.slice(7).trim()
        : typeof providerHeader === 'string'
          ? providerHeader.trim()
          : '';
    if (!token) {
      return next(new ApiError(401, 'UNAUTHORIZED', 'Missing token'));
    }
    try {
      const auth = verifyToken(token);
      if (!roles.includes(auth.role)) {
        return next(new ApiError(403, 'FORBIDDEN', 'Token is not allowed to access this route'));
      }
      req.auth = auth;
      next();
    } catch (err) {
      next(err);
    }
  };

export const getAuth = (req: Request): AuthContext => {
  if (!req.auth) throw new ApiError(401, 'UNAUTHORIZED', 'Not authenticated');
  return req.auth;
};

export const getTenantId = (req: Request): string => {
  const { tenantId } = getAuth(req);
  if (!tenantId) throw new ApiError(401, 'UNAUTHORIZED', 'Token has no tenant');
  return tenantId;
};