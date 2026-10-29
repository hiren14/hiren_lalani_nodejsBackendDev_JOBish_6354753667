import { randomUUID } from 'crypto';

export const newMessageId = (): string => `msg_${randomUUID()}`;
