# Messaging Webhook API

Multi-tenant messaging REST API with an **idempotent provider webhook**, processed asynchronously by a **BullMQ worker**.
Stack: Node 24, Express, TypeScript, Knex + PostgreSQL 18, BullMQ + Redis 8, Joi, JWT, Swagger, Jest. Docker Compose included.

## Quick start (Docker, recommended)

```bash
docker compose up --build
```

This starts Postgres, Redis, runs the Knex migrations, then starts the **api** (port 3000), the **worker**, and **Dozzle** (log viewer).
No `.env` file is needed (compose has local-dev defaults). Host ports `5433` (Postgres) and `6380` (Redis) avoid clashing with local installs.

| What | URL |
|---|---|
| Swagger UI | http://localhost:3000/docs (raw spec: `/docs.json`) |
| Health | http://localhost:3000/health |
| Container logs (Dozzle) | http://localhost:9999 |
| BullMQ dashboard (Bull Board) | http://localhost:3000/admin/queues, login `admin` / `local-admin-change-me` |

Data lives in Docker volumes, so messages survive restarts. `docker compose down -v` wipes them.

> **Upgrading from an older setup?** Postgres 18 cannot read a Postgres 16 volume and mounts its data at `/var/lib/postgresql`. Run `docker compose down -v` once, then `docker compose up --build`.

## Local development (without Docker for the app)

Requires Node 24 (`nvm use 24`).

```bash
cp .env.example .env
docker compose up -d postgres redis      # only the infrastructure
npm install
npm run migrate                          # knex migrate:latest
npm run dev                              # terminal 1: API
npm run dev:worker                       # terminal 2: worker
```

## Tests

```bash
npm test          # 32 tests, no database or Redis needed (repositories/queue are mocked)
npm run typecheck
```

Covers: status transitions (incl. out-of-order), webhook ingest (new, duplicate, unknown message, id conflict, queue failure), worker processing (apply, stale ignored, redelivery), validation 400s, malformed JSON, auth 401/403, tenant mismatch, pagination cursor, masking, dashboard basic auth.

### Full system test against the running stack

- `bash system-test.sh` runs the whole flow (create, read, normal flow, duplicates, out-of-order, FAILED rules, webhook errors, pagination, tenant isolation, health) and prints PASS/FAIL. Needs `curl` and `jq`. `RESTART=1 bash system-test.sh` also checks persistence after `docker compose restart api worker`.
- `messaging-api.postman_collection.json` is the same set of checks as a Postman collection. Import it, run folder **0. Setup** first, then the rest in order.

## Authentication

| Route | Auth |
|---|---|
| `POST /api/v1/auth/register`, `/login`, `/provider-token`, `GET /health`, `/docs` | public |
| `/api/v1/messages*`, `/api/v1/conversations/*` | JWT, role `user` (`Authorization: Bearer <token>`) |
| `POST /api/v1/webhooks/provider` | JWT, role `provider`, sent in the **`x-provider-token`** header (`Authorization: Bearer` also works) |
| `/admin/queues` | HTTP Basic auth (`ADMIN_USER` / `ADMIN_PASSWORD`); not mounted if `ADMIN_PASSWORD` is empty |

- Users log in and get a JWT containing `tenantId`. **The tenant always comes from the token**, never from a header. (The brief allowed `x-tenant-id` as a stand-in for auth; the JWT replaces it.)
- The provider is not a user, so it exchanges `PROVIDER_API_KEY` for a short-lived `provider` JWT via `/auth/provider-token`, then sends that token in `x-provider-token`. In Swagger the webhook route has this header as an explicit field with a description.

## Example flow (curl)

```bash
B=http://localhost:3000/api/v1

curl -s -X POST $B/auth/register -H 'Content-Type: application/json' \
  -d '{"tenantId":"tenant-a","email":"agent@example.com","password":"S3cretPass!"}'

USER_TOKEN=$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"agent@example.com","password":"S3cretPass!"}' | jq -r .data.accessToken)

curl -s -X POST $B/messages -H "Authorization: Bearer $USER_TOKEN" -H 'Content-Type: application/json' \
  -d '{"tenantId":"tenant-a","conversationId":"conv-100","to":"+919876543210","text":"Your order has shipped"}'
# -> 201 {"success":true,"data":{"id":"msg_...","status":"QUEUED",...}}

PROVIDER_TOKEN=$(curl -s -X POST $B/auth/provider-token -H 'Content-Type: application/json' \
  -d '{"apiKey":"local-dev-provider-key-change-me"}' | jq -r .data.accessToken)

curl -s -X POST $B/webhooks/provider -H "x-provider-token: $PROVIDER_TOKEN" -H 'Content-Type: application/json' \
  -d '{"eventId":"evt-001","messageId":"<MESSAGE_ID>","status":"DELIVERED","occurredAt":"2026-10-16T08:30:00.000Z"}'
# -> 202 {"success":true,"data":{"eventId":"evt-001","duplicate":false,"processingState":"PENDING"}}
# send the same body again -> 200 {"...","duplicate":true,...}

curl -s $B/messages/<MESSAGE_ID> -H "Authorization: Bearer $USER_TOKEN"
curl -s "$B/conversations/conv-100/messages?limit=20" -H "Authorization: Bearer $USER_TOKEN"
# next page: add &cursor=<pagination.nextCursor>
```

### Response shapes
- Success: `{ "success": true, "data": ... }` (lists add `"pagination": { limit, hasMore, nextCursor }`)
- Error: `{ "success": false, "error": { "code", "message", "details?" } }`
- Status codes: 400 validation / bad cursor / bad JSON, 401 auth, 403 role or tenant mismatch, 404 unknown message, 409 eventId reused for another message, 413 body too large, 503 queue unavailable.

## Environment variables

See `.env.example` (placeholders only).

| Variable | Purpose |
|---|---|
| `DATABASE_URL`, `REDIS_URL` | connections |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | JWT signing |
| `PROVIDER_API_KEY` | exchanged for the provider JWT |
| `ADMIN_USER`, `ADMIN_PASSWORD` | Bull Board login; empty password disables the dashboard |
| `WORKER_CONCURRENCY`, `JOB_ATTEMPTS`, `JOB_BACKOFF_MS` | BullMQ tuning |
| `LOG_LEVEL` | pino level |

## Schema (Knex migrations in `migrations/`)

| Table | Key columns |
|---|---|
| `users` | `id` uuid PK, `tenant_id`, `email` unique, `password_hash` (bcrypt) |
| `messages` | `id` PK, `seq` bigserial unique (cursor), `tenant_id`, `conversation_id`, `recipient`, `text`, `status` (CHECK), `sent_at`, `delivered_at`, `read_at`, `failed_at`, `created_at`, `updated_at`. Index `(tenant_id, conversation_id, seq)` |
| `webhook_events` | `event_id` **PK**, `message_id` FK, `status`, `occurred_at`, `received_at`, `processing_state` (`PENDING/APPLIED/IGNORED/FAILED`), `outcome`, `attempts`, `processed_at` |

## Design note

**Webhook flow.** validate (Joi) -> message exists? (else 404) -> `INSERT ... ON CONFLICT (event_id) DO NOTHING` -> enqueue BullMQ job (`jobId = evt_<eventId>`) -> `202`. The event row is committed *before* the ack. The worker then locks the event and message rows in one transaction, applies the transition rules, and records the outcome.

**Idempotency (3 layers).** (1) `event_id` primary key: a repeated event can never create a second row. (2) Duplicate delivery returns `200 duplicate:true`. (3) The worker skips events whose state is not `PENDING`, and BullMQ `jobId` prevents double jobs. If a crash left an event `PENDING` without a job, the provider's retry re-enqueues it safely.

**Status transitions** (`src/utils/statusTransition.ts`)
- Order: `QUEUED < SENT < DELIVERED < READ`. Only strictly forward moves apply; equal or lower is ignored as stale.
- Skipping ahead is allowed (a `DELIVERED` can arrive before `SENT`).
- `FAILED` is accepted only from `QUEUED`/`SENT` and is terminal.
- An ignored event still back-fills its own empty timestamp (e.g. late `SENT` after `READ` fills `sent_at`).
- Ordering uses status rank, not `occurredAt`, so clock skew cannot reorder statuses. `occurredAt` is stored as the timestamp.
- Concurrency: `SELECT ... FOR UPDATE` on the message row serialises simultaneous updates.

**Unknown message IDs** return `404` and nothing is stored (the provider should retry later if the message is just not committed yet).

**Tenant isolation.** The tenant is taken from the JWT. Body `tenantId` must match or the request gets `403`. Every message query includes `tenant_id`; another tenant's message returns `404`, same as a missing one.

**Retries and dead letters.** Jobs retry 5x with exponential backoff (`JOB_ATTEMPTS`, `JOB_BACKOFF_MS`). After the last failure the event is marked `FAILED` in Postgres and a job is parked in the `webhook-events-dlq` queue for manual replay. Both queues are visible in Bull Board.

**Logging / PII.** Pino JSON logs with text levels and ISO timestamps (readable in Dozzle) and request-id correlation (`x-request-id`, echoed back). Message text is never logged (length only), phone numbers and emails go through `maskPhone`/`maskEmail`, request logs exclude headers and bodies, and a `redact` list is a safety net. Env validation errors print variable names only.

**Pagination.** Ordered by `seq` (insertion order), cursor is an opaque base64 of the last `seq`. New inserts never shift earlier pages.

## Assumptions, trade-offs, limitations

- **Registration is open** and lets anyone create a user for any `tenantId`. Fine for this exercise; in production tenants/users would be provisioned by an admin flow.
- Provider auth is JWT-from-API-key, as requested. Real providers (e.g. Meta) sign payloads with an HMAC header; that would be the production choice.
- Messages are only stored as `QUEUED`; nothing actually sends them.
- No refresh tokens, rate limiting, or token revocation.
- DLQ replay is manual (retry from Bull Board). Redis should have persistence enabled (compose uses AOF).
- Dozzle mounts the Docker socket and the compose defaults for secrets/admin password are for local use only. Do not expose either, or ship those defaults, to production.
- A late `DELIVERED` after `FAILED` is ignored, and `409 EVENT_ID_CONFLICT` is returned when an eventId is reused for another message (deliberate choices).
- Unit/integration tests mock the DB and Redis; they do not exercise real SQL. `system-test.sh` and the Postman collection cover the real stack. A Testcontainers suite would be the next step.

**At high throughput:** put a real broker (Kafka/SQS) behind the webhook, partition by `messageId` for per-message ordering, shard Postgres by `tenant_id` (or use a distributed SQL DB), keep `event_id` uniqueness per shard, and add an outbox so "store event + publish" is atomic.

## Project layout

```
src/
  config/        env (Joi), db (knex), redis, logger (pino + redact)
  routes/        route definitions + middleware wiring
  controllers/   thin HTTP layer
  services/      business logic (auth, message, webhook)
  repositories/  all SQL (knex)
  validators/    Joi schemas
  middlewares/   authenticate, basicAuth, validate, errorHandler, requestLogger
  queues/ workers/  BullMQ queue + worker
  utils/         ApiError, jwt, mask, cursor, statusTransition, queueDashboard
  docs/openapi.ts  Swagger spec
migrations/      knex migrations (TypeScript)
tests/           unit + integration (supertest)
Dockerfile, docker-compose.yml, .env.example
 messaging-api.postman_collection.json
```

## Note : Commenting out the Dozzle container because of some permission issues on my system as it's optional but a good web based container 
