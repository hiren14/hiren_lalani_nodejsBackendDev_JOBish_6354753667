import { ApiError } from './ApiError';

const PREFIX = 'v1:';

export const encodeCursor = (seq: number): string =>
  Buffer.from(`${PREFIX}${seq}`).toString('base64url');

export const decodeCursor = (cursor: string): number => {
  const raw = Buffer.from(cursor, 'base64url').toString('utf8');
  if (!raw.startsWith(PREFIX) || !/^\d{1,15}$/.test(raw.slice(PREFIX.length))) {
    throw new ApiError(400, 'INVALID_CURSOR', 'cursor is invalid');
  }
  return Number(raw.slice(PREFIX.length));
};
