<div align="center">

# CampusGig — Backend

API & real‑time backend for **CampusGig**, a Fiverr‑style gig marketplace scoped to a university. One account can be both **buyer** and **seller**; an **admin** role keeps the marketplace safe. Payments run through an **escrow** wallet (DB‑backed/simulated in v1 — no real gateway).

[![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Keycloak](https://img.shields.io/badge/Keycloak-26-4D4D4D?logo=keycloak&logoColor=white)](https://www.keycloak.org/)

</div>

Built with **NestJS 10** in a **hexagonal (ports & adapters) + CQRS** style, **Prisma 7 + PostgreSQL**, **Keycloak** auth, **Redis + BullMQ** for caching and scheduled jobs, and **Socket.IO** for real‑time.


---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Getting started (development)](#getting-started-development)
- [Environment variables](#environment-variables)
- [Database, migrations & seeding](#database-migrations--seeding)
- [Creating an admin](#creating-an-admin)
- [API conventions](#api-conventions)
- [Authentication & authorization](#authentication--authorization)
- [Real‑time, jobs & caching](#real-time-jobs--caching)
- [Testing](#testing)
- [Observability](#observability)
- [Production deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)

---

## Features

- **Gig lifecycle** — sellers create gigs (4‑step flow); admins approve/reject; editing *sensitive* fields re‑queues a gig for review (price/delivery edits apply immediately).
- **Browse & search** — public catalog with filters (price, rating, delivery time, endorsed‑only) and sorts (newest, highest‑rated, most completed orders), backed by denormalized counters.
- **Orders & escrow** — full order state machine (`PendingReview → InProgress → Late → Delivered → AwaitingFinalization → Completed`, plus `Cancelled`/`Frozen`) with exact‑hour deadline jobs, atomic escrow money moves, and an **80/20** platform fee on completion.
- **Disputes** — either party can file; 48h response window; admin verdict (`RefundBuyer` / `CompleteForSeller` / `SplitFunds`) with evidence + order chat history.
- **Wallet** — deposits (instant, simulated), escrow holds, earnings, and withdrawals with admin approval.
- **Reviews & ratings** — buyers review completed orders; sellers reply once; per‑gig + per‑seller aggregates.
- **Messaging** — one thread per user pair, attachments, presence, read cursors; order‑scoped system events.
- **Notifications** — in‑app + email, event‑driven.
- **Admin suite** — gig queue, disputes, withdrawals, user endorsement, categories, metrics dashboard, Excel reports, audit log.

---

## Tech stack

| Area | Choice |
|---|---|
| Runtime | Node.js **22** (Alpine in Docker) · package manager **pnpm 10** |
| Framework | NestJS **10** (`@nestjs/cqrs`, `@nestjs/schedule`, `@nestjs/throttler`, `@nestjs/terminus`, `@nestjs/swagger`) |
| Database | PostgreSQL **16** via **Prisma 7** (`prisma-client` generator → `generated/prisma`, `@prisma/adapter-pg` pooling) |
| Auth | **Keycloak 26** (realm `campusgig`) — JWT bearer, global guards |
| Cache / queues | **Redis 7** + **BullMQ** (scheduled order/dispute deadline jobs); 2‑layer (in‑memory LRU + Redis) cache |
| Real‑time | **Socket.IO** gateway (`/ws` namespace) |
| Files | `multer` + `sharp` (image processing) + S3 (`@aws-sdk/client-s3`, presigned URLs) |
| Email | `nodemailer` + `@nestjs-modules/mailer` + Handlebars templates |
| Reports | `exceljs` |
| Observability | `nestjs-pino` → Loki · Prometheus metrics · Grafana dashboards |
| Validation | `class-validator` / `class-transformer`; env via Joi |

---

## Architecture

CampusGig follows **hexagonal architecture** (ports & adapters) with **CQRS**. Each feature is a self‑contained NestJS module split into four layers:

```
src/modules/<feature>/
├── domain/            # Entities, value objects, repository PORTS (interfaces), domain events
├── application/       # CQRS use-cases
│   ├── commands/      #   write operations + handlers
│   ├── queries/       #   read operations + handlers
│   └── events/        #   event handlers (cache invalidation, notifications, sockets)
├── infrastructure/    # ADAPTERS: Prisma repositories, S3 storage, external clients
└── presentation/      # HTTP controllers + request/response DTOs + decorators
```

The **domain** layer defines repository ports (e.g. `ORDERS_REPOSITORY_PORT`); the **infrastructure** layer provides Prisma adapters bound via DI in each `*.module.ts`. Controllers stay thin — they dispatch commands/queries through `CommandBus`/`QueryBus`. Domain code imports nothing framework‑specific, so use‑cases are unit‑testable against mocked ports.

**Feature modules** (`src/modules/`):

| Module | Responsibility |
|---|---|
| `users` | Profiles, skills, portfolio, endorsements, JIT provisioning from Keycloak |
| `categories` | Category CRUD (admin) + public list |
| `gigs` | Seller‑side gig CRUD, images, publish lifecycle |
| `public-gigs` | Buyer‑side browse / search / gig detail |
| `wishlist` | Saved gigs |
| `wallet` | Balance, transactions, deposits, withdrawals (+ admin approval) |
| `messaging` | Threads, messages, attachments, presence (Socket.IO) |
| `orders` | Order state machine, escrow, deliveries, extensions/cancellations, deadline jobs |
| `reviews` | Reviews, seller replies, rating aggregates |
| `disputes` | Filing, response, evidence, admin verdict + payout |
| `notifications` | In‑app + email notifications |
| `dashboard` | Buyer/seller dashboard aggregates |
| `admin-activity` | Admin audit log |
| `admin-metrics` | Admin dashboard metrics + charts |
| `admin-reports` | Excel report exports |
| `stats` | Public platform stats (landing trust strip) + gig views |

Cross‑cutting concerns live under `src/shared/` (`auth`, `cache`, `email`, `keycloak`, `monitoring`, `persistence`, `storage`, `throttler`, response/transform interceptors, decorators).

---

## Project structure

```
campusgig-backend/
├── src/
│   ├── main.ts                 # bootstrap: global prefix /api, URI versioning v1, Swagger, guards
│   ├── app.module.ts           # root module — registers all feature modules
│   ├── config/                 # typed config (app, database, redis, keycloak, …) + Joi validation
│   ├── modules/                # feature modules (see table above)
│   ├── shared/                 # cross-cutting infrastructure + presentation helpers
│   └── health/                 # /health/live readiness/liveness (Terminus)
├── prisma/
│   ├── schema.prisma           # datasource + prisma-client generator (multi-file)
│   ├── models/                 # split model files (gigs, orders, users, disputes, …)
│   ├── migrations/             # SQL migrations
│   ├── seed.ts                 # demo data seeder (see below)
│   └── reconcile-review-aggregates.ts  # maintenance: recompute denormalized counters
├── scripts/admin-create.ts     # provision a Keycloak admin
├── test/                       # e2e tests + jest setup
├── Dockerfile                  # multi-stage: base → deps → build → dev → prod
├── docker-compose.dev.yaml     # app + db + redis + keycloak + monitoring (hot-reload)
├── docker-compose.prod.yaml    # hardened single-VPS stack
└── .env.example                # all env vars (copy to .env.development / .env.production)
```

---

## Getting started (development)

**Prerequisites:** Docker + Docker Compose. (Node 22 + pnpm 10 only if you run the app outside Docker.)

```bash
# 1. Configure env
cp .env.example .env.development      # then fill in secrets (DB, Redis, Keycloak…)

# 2. Bring up the full stack (app + Postgres + Redis + Keycloak + monitoring)
pnpm docker:dev                       # docker compose -f docker-compose.dev.yaml up -d --build

# 3. Tail the API logs
pnpm docker:logs                      # docker logs campusgig-app-dev -f

# 4. Apply migrations + seed demo data (first run)
pnpm prisma:migrate
pnpm prisma:seed                      # SEED_FORCE=1 pnpm prisma:seed  → wipe & reseed
```

The dev container runs `pnpm install → prisma generate → nest start --watch`, with the source bind‑mounted for hot reload (debug port `9229`).

Once up (default dev ports — all env‑driven):

| Service | URL |
|---|---|
| API | `http://localhost:8888/api/v1` |
| Swagger / OpenAPI | `http://localhost:8888/api-docs` |
| Health | `http://localhost:8888/api/v1/health/live` |
| BullMQ dashboard | `http://localhost:8888/admin/queues` (basic auth) |
| Keycloak | `http://localhost:8085` |
| PostgreSQL | `localhost:5001` |
| Grafana · Prometheus | `http://localhost:3001` · `:9090` |

**Run the app on the host instead** (infra in Docker, app local):

```bash
docker compose -f docker-compose.dev.yaml up -d db redis keycloak
pnpm install && pnpm dev
```

---

## Environment variables

Copy `.env.example` and fill in. Key groups:

| Group | Vars |
|---|---|
| App | `NODE_ENV`, `PORT`, `API_PREFIX` (→ `/api/v1`), `APP_NAME`, `BASE_URL`, `CORS_ORIGINS`, `GRACEFUL_SHUTDOWN_TIMEOUT_MS` |
| Database | `DATABASE_URL`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` |
| Redis / cache | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_TTL`, `CACHE_TTL`, `CACHE_LRU_SIZE` |
| Keycloak | `KEYCLOAK_HOST`, `KEYCLOAK_PORT`, `KEYCLOAK_PUBLIC_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET`, `KEYCLOAK_ADMIN_USER`, `KEYCLOAK_ADMIN_PASSWORD`, `KEYCLOAK_DB_NAME` |
| Rate limiting | `THROTTLE_TTL`, `THROTTLE_LIMIT` |
| Email | `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM_NAME`, `EMAIL_FROM_ADDRESS` |
| Storage | `STORAGE_TYPE` (`local`\|`s3`), `UPLOAD_DEST`, `MAX_FILE_SIZE`, `ALLOWED_FILE_TYPES`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET` |
| Observability | `LOG_LEVEL`, `LOKI_ENABLED`, `LOKI_HOST`, `PROMETHEUS_ENABLED`, `GRAFANA_*` |
| BullMQ dashboard | `BULL_BOARD_USER`, `BULL_BOARD_PASSWORD` |

---

## Database, migrations & seeding

Prisma uses the **`prisma-client` generator** (output `generated/prisma`) with the split‑model layout under `prisma/models/`, and the **pg adapter** for pooling.

```bash
pnpm prisma:migrate          # create + apply a dev migration (dotenv -e .env.development)
pnpm prisma:generate         # regenerate the client after a schema change
pnpm prisma:studio           # open Prisma Studio
pnpm prisma:seed             # seed demo data  (SEED_FORCE=1 to wipe + reseed)
pnpm prisma:reset            # drop, re-migrate, re-seed
```

**Seeding (`prisma/seed.ts`)** builds a realistic demo dataset: ~140 users, ~330 gigs (most rated via a large historical‑orders layer), demo orders across every state, disputes with chat + evidence + delivered files, portfolios, and wallet history. Seeded users carry a `seed-` Keycloak‑ID prefix (the only marker; cleanup keys off it). The seeder is idempotent and recomputes all denormalized aggregates at the end.

**Maintenance:** `reconcile-review-aggregates.ts` recomputes `Gig`/`User` review counts, `avgRating`, and `completedOrderCount` from source rows if they ever drift:

```bash
pnpm exec dotenv -e .env.development -- ts-node prisma/reconcile-review-aggregates.ts
```

**Production** runs migrations automatically on container start (`prisma migrate deploy && node dist/src/main`).

---

## Creating an admin

`scripts/admin-create.ts` provisions a **Keycloak** user, ensures the `admin` realm role, assigns it, and prints a one‑time password. The local DB `User` row (with `isAdmin=true`) is created lazily on that admin's first authenticated request.

```bash
pnpm admin:create --email admin@campusgig.local --displayName "Admin User"
```

---

## API conventions

- **Prefix + versioning:** every route is under `/api/<version>`, default `/api/v1` (URI versioning).
- **Response envelope:** responses are wrapped as `{ meta: { code, type, message, … }, data }` by a global transform interceptor; errors share the same shape.
- **Wire format:** request bodies arrive `snake_case` and are converted to `camelCase` for DTOs; responses are converted back to `snake_case`. (camelCase in TS, snake_case on the wire — never bypass.)
- **OpenAPI:** Swagger UI at `/api-docs` with bearer‑JWT auth; the CLI plugin generates schemas from `class-validator` decorators.
- **Health:** `GET /api/v1/health/live` (Terminus — DB, Redis, cache).
- **Idempotency:** money‑mutating endpoints honor an `Idempotency-Key` header (Redis‑backed).

---

## Authentication & authorization

- **Keycloak** (realm `campusgig`) issues JWTs; a global `KeycloakAuthGuard` validates the bearer token on every request.
- `@Public()` opts a route out of auth (landing, browse, gig detail, public stats).
- `@Roles('admin')` / `@AdminOnly()` + a `RolesGuard` gate the admin endpoints.
- New users are **JIT‑provisioned** into the DB on first authenticated call; admins get `isAdmin=true` from their realm role.

---

## Real‑time, jobs & caching

- **Socket.IO** gateway on the `/ws` namespace (JWT handshake). Rooms: `user:${id}` + feature rooms. Powers chat, notifications, order updates, and presence (deduped across tabs via Redis). Socket payloads bypass the HTTP case‑conversion interceptors.
- **BullMQ** schedules exact‑hour deadline jobs: accept (24h), delivery deadline, review/auto‑complete (72h), dispute window (7 days). Inspectable at `/admin/queues`.
- **2‑layer cache:** in‑memory LRU (L1) + Redis (L2), with event‑driven invalidation (e.g. gig approval and review submit clear the browse cache).
- **Money atomicity:** every escrow/refund/release runs inside a single Prisma `$transaction`; order money transitions take a `SELECT … FOR UPDATE` row lock to serialize concurrent buyer/job actions.

---

## Testing

```bash
pnpm test            # unit tests (Jest)
pnpm test:watch
pnpm test:cov        # coverage
pnpm test:e2e        # e2e (test/jest-e2e.config.js)
```

Handlers, utilities, and domain logic are unit‑tested with mocked repository ports. Run `pnpm lint` and `pnpm format:check` before committing (Husky + lint‑staged enforce this on commit).

---

## Observability

Structured logs via `nestjs-pino` are shipped to **Loki** and viewable in **Grafana**; **Prometheus** scrapes app + node metrics. Both compose files include the full Grafana/Loki/Promtail/Prometheus/node‑exporter stack.

---

## Production deployment

Single‑VPS deployment via `docker-compose.prod.yaml` (multi‑stage `Dockerfile`, `target: prod` — `pnpm install --prod`, compiled `dist/`, non‑root user, Prisma engines baked in):

```bash
cp .env.example .env.production      # fill in production secrets
docker compose -f docker-compose.prod.yaml up -d --build
```

- Nginx on the host terminates TLS and routes `campusgig.tech` (frontend), `api.campusgig.tech` (this API), and `auth.campusgig.tech` (Keycloak). App/DB/Redis/Keycloak bind to `127.0.0.1` only.
- Migrations run on container start; health is probed at `/api/v1/health/live` (180s start period to wait out Keycloak's cold boot).
- Resource limits, log rotation, and persistent volumes (DB, Redis AOF, uploads) are configured in the compose file.

### Pre‑deploy checklist

- [ ] Strong secrets set (`KEYCLOAK_CLIENT_SECRET`, DB/Redis passwords, BullMQ dashboard creds).
- [ ] `DATABASE_URL` + `REDIS_*` + `KEYCLOAK_*` point at production.
- [ ] `CORS_ORIGINS` lists only the production frontend origin(s).
- [ ] TLS + reverse proxy (Nginx) in front; app not exposed publicly.
- [ ] Backups configured for the Postgres volume.
- [ ] Health checks wired into your process manager / orchestrator.

---

## Troubleshooting

- **Keycloak admin locked out / deleted** — restart the Keycloak container so it re‑bootstraps the admin from `KEYCLOAK_ADMIN_*`, or run `kc.sh bootstrap-admin user --username:env KEYCLOAK_ADMIN --password:env KEYCLOAK_ADMIN_PASSWORD` inside it.
- **Stale Prisma client (missing new columns)** — `pnpm prisma:generate` (the dev container regenerates on restart; the host client is separate).
- **Watcher didn't pick up a new module/file (Docker on Windows)** — restart the app container.
- **Badge counts vs. live counts disagree** — run the reconcile script.

---

## License

MIT
