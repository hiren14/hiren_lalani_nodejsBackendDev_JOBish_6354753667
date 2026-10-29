export const MESSAGE_STATUSES = ['QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED'] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const PROVIDER_STATUSES = ['SENT', 'DELIVERED', 'READ', 'FAILED'] as const;
export type ProviderStatus = (typeof PROVIDER_STATUSES)[number];

export type EventState = 'PENDING' | 'APPLIED' | 'IGNORED' | 'FAILED';
export type Role = 'user' | 'provider';

export interface Message {
  id: string;
  seq: number;
  tenantId: string;
  conversationId: string;
  to: string;
  text: string;
  status: MessageStatus;
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  failedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessagePatch {
  status?: MessageStatus;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  failedAt?: Date;
}

export interface WebhookEvent {
  eventId: string;
  messageId: string;
  status: ProviderStatus;
  occurredAt: Date;
  receivedAt: Date;
  processingState: EventState;
  outcome: string | null;
  attempts: number;
}

export interface AuthContext {
  userId: string;
  role: Role;
  tenantId?: string;
}

export interface WebhookPayload {
  eventId: string;
  messageId: string;
  status: ProviderStatus;
  occurredAt: Date;
}

export interface CreateMessageInput {
  tenantId: string;
  conversationId: string;
  to: string;
  text: string;
}
