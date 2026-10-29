import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError } from './ApiError';
import type { AuthContext, Role } from '../types';

const ISSUER = 'messaging-api';

interface TokenPayload {
  sub: string;
  role: Role;
  tenantId?: string;
}

export const signToken = (payload: TokenPayload): string =>
  jwt.sign(payload, env.jwtSecret, {
    algorithm: 'HS256',
    issuer: ISSUER,
    expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });

export const verifyToken = (token: string): AuthContext => {
  try {
    const decoded = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'], issuer: ISSUER });
    if (typeof decoded === 'string' || !decoded.sub) throw new Error('bad payload');
    const role = decoded.role as Role;
    if (role !== 'user' && role !== 'provider') throw new Error('bad role');
    if (role === 'user' && !decoded.tenantId) throw new Error('missing tenant');
    return { userId: decoded.sub, role, tenantId: decoded.tenantId as string | undefined };
  } catch {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }
};
