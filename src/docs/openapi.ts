const json = (schema: unknown) => ({ 'application/json': { schema } });
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const err = (description: string) => ({ description, content: json(ref('Error')) });
const secured = [{ bearerAuth: [] }];

const authErrors = {
  '401': err('Missing, invalid or expired token'),
  '403': err('Token role/tenant not allowed'),
};

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Messaging Webhook API',
    version: '1.0.0',
    description:
      'Multi-tenant messaging API with idempotent provider webhooks.\n\n' +
      '**Auth:** call `/auth/login` (users) or `/auth/provider-token` (provider), then click **Authorize** and paste the access token.',
  },
  servers: [{ url: '/' }],
  tags: [
    { name: 'Auth' },
    { name: 'Messages' },
    { name: 'Webhooks' },
    { name: 'Health' },
  ],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string' },
              details: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
      RegisterRequest: {
        type: 'object',
        required: ['tenantId', 'email', 'password'],
        properties: {
          tenantId: { type: 'string', example: 'tenant-a' },
          email: { type: 'string', example: 'agent@example.com' },
          password: { type: 'string', minLength: 8, maxLength: 72, example: 'S3cretPass!' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', example: 'agent@example.com' },
          password: { type: 'string', example: 'S3cretPass!' },
        },
      },
      ProviderTokenRequest: {
        type: 'object',
        required: ['apiKey'],
        properties: { apiKey: { type: 'string', example: 'value of PROVIDER_API_KEY' } },
      },
      TokenResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              accessToken: { type: 'string' },
              tokenType: { type: 'string', example: 'Bearer' },
              expiresIn: { type: 'string', example: '1h' },
            },
          },
        },
      },
      CreateMessageRequest: {
        type: 'object',
        required: ['tenantId', 'conversationId', 'to', 'text'],
        properties: {
          tenantId: { type: 'string', maxLength: 64, example: 'tenant-a', description: 'Must equal the tenant in the JWT' },
          conversationId: { type: 'string', maxLength: 128, example: 'conv-100' },
          to: { type: 'string', example: '+919876543210', description: 'E.164 phone number' },
          text: { type: 'string', maxLength: 4096, example: 'Your order has shipped' },
        },
      },
      Message: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'msg_6f1c...' },
          tenantId: { type: 'string' },
          conversationId: { type: 'string' },
          to: { type: 'string' },
          text: { type: 'string' },
          status: { type: 'string', enum: ['QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED'] },
          timestamps: {
            type: 'object',
            properties: {
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
              sentAt: { type: 'string', format: 'date-time', nullable: true },
              deliveredAt: { type: 'string', format: 'date-time', nullable: true },
              readAt: { type: 'string', format: 'date-time', nullable: true },
              failedAt: { type: 'string', format: 'date-time', nullable: true },
            },
          },
        },
      },
      MessageResponse: {
        type: 'object',
        properties: { success: { type: 'boolean', example: true }, data: ref('Message') },
      },
      MessageListResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'array', items: ref('Message') },
          pagination: {
            type: 'object',
            properties: {
              limit: { type: 'integer' },
              hasMore: { type: 'boolean' },
              nextCursor: { type: 'string', nullable: true },
            },
          },
        },
      },
      WebhookEventRequest: {
        type: 'object',
        required: ['eventId', 'messageId', 'status', 'occurredAt'],
        properties: {
          eventId: { type: 'string', pattern: '^[A-Za-z0-9_.-]{1,128}$', example: 'evt-001' },
          messageId: { type: 'string', example: 'msg_6f1c...' },
          status: { type: 'string', enum: ['SENT', 'DELIVERED', 'READ', 'FAILED'] },
          occurredAt: { type: 'string', format: 'date-time', example: '2026-10-16T08:30:00.000Z' },
        },
      },
      WebhookResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              eventId: { type: 'string' },
              duplicate: { type: 'boolean' },
              processingState: { type: 'string', enum: ['PENDING', 'APPLIED', 'IGNORED', 'FAILED'] },
            },
          },
        },
      },
    },
  },
  paths: {
    '/api/v1/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a user for a tenant',
        requestBody: { required: true, content: json(ref('RegisterRequest')) },
        responses: {
          '201': { description: 'User created' },
          '400': err('Validation error'),
          '409': err('Email already registered'),
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in and receive a JWT (carries tenantId)',
        requestBody: { required: true, content: json(ref('LoginRequest')) },
        responses: {
          '200': { description: 'JWT issued', content: json(ref('TokenResponse')) },
          '400': err('Validation error'),
          '401': err('Invalid credentials'),
        },
      },
    },
    '/api/v1/auth/provider-token': {
      post: {
        tags: ['Auth'],
        summary: 'Exchange the provider API key for a provider JWT (webhook caller)',
        requestBody: { required: true, content: json(ref('ProviderTokenRequest')) },
        responses: {
          '200': { description: 'JWT issued', content: json(ref('TokenResponse')) },
          '400': err('Validation error'),
          '401': err('Invalid API key'),
        },
      },
    },
    '/api/v1/messages': {
      post: {
        tags: ['Messages'],
        summary: 'Create a message (status QUEUED)',
        security: secured,
        requestBody: { required: true, content: json(ref('CreateMessageRequest')) },
        responses: {
          '201': { description: 'Message created', content: json(ref('MessageResponse')) },
          '400': err('Validation error'),
          ...authErrors,
        },
      },
    },
    '/api/v1/messages/{messageId}': {
      get: {
        tags: ['Messages'],
        summary: 'Get a message with status and timestamps (tenant scoped)',
        security: secured,
        parameters: [{ name: 'messageId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Message', content: json(ref('MessageResponse')) },
          '404': err('Not found (also returned for other tenants\' messages)'),
          ...authErrors,
        },
      },
    },
    '/api/v1/conversations/{conversationId}/messages': {
      get: {
        tags: ['Messages'],
        summary: 'List conversation messages, oldest first, cursor paginated',
        security: secured,
        parameters: [
          { name: 'conversationId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
          { name: 'cursor', in: 'query', schema: { type: 'string' }, description: 'nextCursor from the previous page' },
        ],
        responses: {
          '200': { description: 'Page of messages', content: json(ref('MessageListResponse')) },
          '400': err('Invalid limit or cursor'),
          ...authErrors,
        },
      },
    },
    '/api/v1/webhooks/provider': {
      post: {
        tags: ['Webhooks'],
        summary: 'Provider status event (idempotent by eventId)',
        description:
          'Called by the messaging provider. Authenticated with the provider token returned by ' +
          '`POST /api/v1/auth/provider-token` (send it in the `x-provider-token` header).\n\n' +
          '- Same `eventId` sent again returns **200** with `duplicate: true` and changes nothing.\n' +
          '- Older/out-of-order statuses never move a message backwards (READ -> SENT is ignored).\n' +
          '- Unknown `messageId` returns **404**.',
        parameters: [
          {
            name: 'x-provider-token',
            in: 'header',
            required: true,
            schema: { type: 'string' },
            description:
              'Provider JWT. Get it from `POST /api/v1/auth/provider-token` (field `data.accessToken`) and paste only the token, without "Bearer".',
          },
        ],
        requestBody: { required: true, content: json(ref('WebhookEventRequest')) },
        responses: {
          '202': { description: 'Event stored and queued', content: json(ref('WebhookResponse')) },
          '200': { description: 'Duplicate eventId: nothing new done', content: json(ref('WebhookResponse')) },
          '400': err('Validation error'),
          '404': err('Unknown messageId'),
          '409': err('eventId already used for a different message'),
          '503': err('Queue unavailable, retry later'),
          ...authErrors,
        },
      },
    },
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Liveness + database/redis connectivity (public)',
        responses: {
          '200': { description: 'All dependencies up' },
          '503': { description: 'A dependency is down' },
        },
      },
    },
  },
};