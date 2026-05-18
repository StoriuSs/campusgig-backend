<div align="center">

# CampusGig Backend

A production-ready backend for the CampusGig platform featuring Keycloak authentication, Prisma ORM, distributed caching, rate limiting,... and more.

[![Node.js](https://img.shields.io/badge/Node.js-≥20.0.0-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Keycloak](https://img.shields.io/badge/Keycloak-4D4D4D?logo=keycloak&logoColor=white)](https://www.keycloak.org/)
[![Prometheus](https://img.shields.io/badge/Prometheus-E6522C?logo=prometheus&logoColor=white)](https://prometheus.io/)
[![Grafana](https://img.shields.io/badge/Grafana-F46800?logo=grafana&logoColor=white)](https://grafana.com/)
[![Swagger](https://img.shields.io/badge/Swagger-85EA2D?logo=swagger&logoColor=black)](https://swagger.io/)

</div>

---

## Table of Contents

- [Quickstart](#quickstart)
- [Why This Template?](#why-this-template)
- [Features](#features)
- [Running Locally](#running-locally)
- [Project Structure](#project-structure)
- [Architecture Overview](#architecture-overview)
- [Documentation](#documentation)
- [Production Checklist](#production-checklist)
- [Contributing](#contributing)

---

## Quickstart

### Prerequisites

- Node.js ≥ 20.0.0
- npm ≥ 9.0.0
- PostgreSQL ≥ 14
- Redis ≥ 6.0
- Keycloak (for authentication)

```bash
npm install
cp .env.example .env

# Start PostgreSQL and Redis (using Docker)
docker-compose up -d

# Setup database
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed  # Optional

# Start development server
npm run dev
```

Then open:

- API Docs (Swagger UI): `http://localhost:9999/api-docs`
- Health Checks: `http://localhost:9999/api/health`
- Grafana (Monitoring): `http://localhost:3002` (admin/admin)
- Prometheus: `http://localhost:9090`

> [!NOTE]
> Ports and routes may differ depending on your `.env` configuration.

---

## Why This Template?

This template is built for teams who want to ship **production-grade NestJS services** quickly — without reinventing foundational infrastructure.

It focuses on:

- **Strong defaults** (security, logging, config validation)
- **Scalability** (Redis-backed caching + throttling)
- **Observability** (Prometheus metrics, Loki logs, Grafana dashboards)
- **Documentation** (15+ detailed docs covering every module)

---

## Features

| Feature                   | Description                                          |
|---------------------------|------------------------------------------------------|
| 🏛️ **Hexagonal Architecture** | Ports & Adapters for clean separation of concerns |
| 📦 **CQRS**               | Command/Query separation via NestJS CQRS module      |
| 🔐 **Authentication**     | Keycloak SSO with JWT validation                     |
| 🚀 **Two-Level Caching**  | In-memory LRU + Redis distributed cache              |
| 🛡️ **Rate Limiting**     | User & IP-based with Redis backend                   |
| 🗄️ **Database**          | PostgreSQL with Prisma ORM + soft delete             |
| 📁 **File Uploads**       | Local + S3 storage with Sharp image processing       |
| 🩺 **Health Checks**      | Terminus-based monitoring (DB, Redis, Throttler)     |
| 📊 **Metrics & Logs**     | Prometheus + Grafana + Loki for full observability   |
| 📝 **Structured Logging** | Pino with JSON output + request tracing              |
| 📖 **API Documentation**  | OpenAPI 3.0 with Swagger UI                          |
| 🔒 **Security**           | Helmet, CORS, validation pipes                       |
| ⚡ **Graceful Shutdown**   | Zero-downtime friendly shutdown hooks                |
| 🔄 **Idempotency**        | Request deduplication for POST/PATCH                 |
| 📧 **Email**              | Transactional emails with Handlebars templates       |

---

## Running Locally

### Database Setup

```bash
# Start PostgreSQL and Redis (using Docker)
docker-compose up -d

# Generate Prisma client
npm run prisma:generate

# Apply migrations
npm run prisma:migrate

# Seed database (optional)
npm run prisma:seed
```

### Running the Application

```bash
# Development (with hot reload)
npm run dev

# Production build
npm run build
npm run start:prod
```

### Running Tests

```bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:cov

# E2E tests
npm run test:e2e
```

---

## Project Structure

```
src/
├── config/                          # App-wide configuration
│   ├── database.config.ts
│   ├── cache.config.ts
│   ├── keycloak.config.ts
│   └── ...                          # throttle, upload, cors, etc.
├── modules/                         # Feature modules (Hexagonal Architecture)
│   └── users/                       # Example: Users module
│       ├── domain/                  # Entities, exceptions, repository ports
│       ├── application/             # Commands, queries, events, service ports
│       ├── infrastructure/          # Prisma repository, cache/storage adapters
│       ├── presentation/            # HTTP controllers, DTOs, consumers, filters
│       └── users.module.ts          # Port → Adapter wiring
├── shared/                          # Cross-cutting shared code
│   ├── infrastructure/              # Auth guards, cache, storage, email, Prisma
│   ├── presentation/                # Interceptors, pipes, filters, decorators
│   ├── domain/                      # Shared domain exceptions
│   ├── constants/                   # Response codes, messages
│   ├── types/                       # Shared type definitions
│   └── utils/                       # Pagination, validation helpers
├── health/                          # Health check endpoints
├── app.module.ts                    # Root application module
└── main.ts                          # Application entry point
```

---

## Architecture Overview

This project uses **Hexagonal Architecture (Ports & Adapters)** with **CQRS**. Business logic is isolated from infrastructure through port interfaces, with adapters plugged in via dependency injection.

See [Hexagonal Architecture Guide](docs/hexagonal-architecture.md) and [CQRS Guide](docs/cqrs-guide.md) for full details.

### Why This Architecture?

- **Swappable infrastructure** — Change databases, caches, or storage by replacing one adapter
- **Testability** — Mock port interfaces without spinning up real services
- **Clear boundaries** — Domain logic has zero imports from NestJS, Prisma, or any framework
- **CQRS** — Separate read/write paths for scalable, maintainable use cases

### Where to Look

| If you want to...              | Look in...                                      |
|-------------------------------|--------------------------------------------------|
| Change database connection    | `src/config/database.config.ts`                  |
| Modify cache behavior         | `src/config/cache.config.ts`                     |
| Adjust rate limits            | `src/config/throttle.config.ts`                  |
| Configure authentication      | `src/shared/infrastructure/auth/`                |
| Add file upload options       | `src/shared/infrastructure/storage/`             |
| Add health checks             | `src/health/health.controller.ts`                |
| Add a new feature module      | Create in `src/modules/` with hexagonal layers   |
| Understand the architecture   | `docs/hexagonal-architecture.md`                 |

---

## Documentation

Comprehensive documentation is available in the `docs/` folder:

| Document | Description |
|----------|-------------|
| [Hexagonal Architecture](docs/hexagonal-architecture.md) | Ports & Adapters architecture guide |
| [CQRS Guide](docs/cqrs-guide.md) | Command/Query separation patterns |
| [Auth Module](docs/auth-module.md) | Keycloak integration & JWT handling |
| [Cache](docs/cache.md) | Two-layer caching architecture |
| [Rate Limiting](docs/rate-limit.md) | Distributed throttling |
| [Monitoring](docs/monitoring.md) | Prometheus metrics & Grafana dashboards |
| [Logging](docs/logging.md) | Loki log aggregation & querying |
| [Graceful Shutdown](docs/graceful-shutdown.md) | Zero-downtime deployments |
| [Type Safety](docs/type-safety.md) | Type-safe selects and DTOs |
| [Testing](docs/testing.md) | Unit, integration, E2E testing |
| [Upload Module](docs/upload-module.md) | File storage & image processing |
| [Idempotency](docs/idempotency.md) | Request deduplication |
| [BullMQ Guide](docs/BULLMQ-GUIDE.md) | Background job processing |

---

## Production Checklist

Before deploying to production:

- [ ] Set strong secrets (`JWT_SECRET`, `KEYCLOAK_CLIENT_SECRET`)
- [ ] Configure `DATABASE_URL` and `REDIS_*` for production
- [ ] Verify CORS settings for allowed origins
- [ ] Configure Helmet security headers for your environment
- [ ] Set up trusted proxies if behind load balancers
- [ ] Wire health checks into orchestration (K8s, ECS, etc.)
- [ ] Configure log shipping (Datadog, ELK, Loki)
- [ ] Tune Redis TTLs and memory limits
- [ ] Confirm graceful shutdown timeout matches orchestrator

---

## Contributing

PRs and issues are welcome.

Guidelines:

- Keep infrastructure modules isolated and configurable
- Add health indicators when introducing new dependencies
- Include tests for new behavior
- Ensure linting and tests pass before submitting

---

## License

MIT
