# Getting Started

This guide walks you through setting up the NestJS starter on your local machine.

## Prerequisites

- **Node.js** 18+ and npm
- **Docker** and Docker Compose
- **Git**

---

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd nest-starter
npm install
```

### 2. Environment Setup

Copy the example environment file:

```bash
cp .env.example .env
```

**Required configurations in `.env`:**

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection | `postgresql://user:pass@localhost:5432/mydb` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6500` |
| `KEYCLOAK_REALM` | Your Keycloak realm name | `myrealm` |
| `KEYCLOAK_CLIENT_ID` | Your Keycloak client ID | `nestjs-app` |
| `KEYCLOAK_CLIENT_SECRET` | Your Keycloak client secret | (see Keycloak setup) |

> **Note:** Most default values work out of the box for local development.

### 3. Start Docker Services

```bash
docker-compose up -d
```

This starts:
- PostgreSQL (port 5432)
- Redis (port 6500)
- Keycloak (port 8080)
- Prometheus (port 9090)
- Grafana (port 3002)
- Loki (port 3100)
- Promtail (log shipping)

### 4. Configure Keycloak

Follow the [Keycloak Setup Guide](./docs/keycloak-setup.md) to:
1. Access Keycloak at http://localhost:8080
2. Create a realm
3. Create a client
4. Get the client secret
5. Update `.env` with realm name, client ID, and secret

### 5. Database Setup

Run Prisma migrations:

```bash
npx prisma migrate dev
```

(Optional) Seed the database:

```bash
npx prisma db seed
```

### 6. Start the Application

```bash
npm run dev
```

The API will be available at: http://localhost:9999/api/v1

---

## Verify Setup

### Check Health

```bash
curl http://localhost:9999/api/v1/health/ready
```

Expected response:
```json
{
  "meta": {
    "code": "200500",
    "type": "HEALTH_CHECK",
    "message": "Health check passed"
  },
  "data": {
    "status": "ok",
    "timestamp": "2026-01-16T08:00:00.000Z",
    "uptime": 123.45
  }
}
```

### Access Monitoring

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3002 (admin/admin)
- **Loki**: http://localhost:3100 (accessed via Grafana)

---

## Common Customizations

### Change Application Port

Edit `.env`:
```bash
PORT=3000  # Default is 9999
```

**Also update `prometheus.yml`** to match the new port:
```yaml
scrape_configs:
  - job_name: 'nestjs-app'
    scrape_interval: 5s
    static_configs:
      - targets: ['host.docker.internal:3000']  # Update port here
    metrics_path: '/api/v1/metrics'
```

Then restart Prometheus:
```bash
docker-compose restart prometheus
```

### Change Database Credentials

1. Update `docker-compose.yaml` PostgreSQL environment variables
2. Update `DATABASE_URL` in `.env`
3. Restart containers: `docker-compose restart postgres`

### Disable Monitoring (Prometheus/Grafana)

Edit `.env`:
```bash
PROMETHEUS_ENABLED=false
```

Then stop the services:
```bash
docker-compose stop prometheus grafana
```

### Disable Log Aggregation (Loki/Promtail)

Stop the logging services:
```bash
docker-compose stop loki promtail
```

To prevent them from starting automatically:
1. Comment out the `loki` and `promtail` services in `docker-compose.yaml`
2. Or remove the services entirely if you don't need them

---

## Project Structure

```
├── src/
│   ├── config/         # App-wide configuration (database, cache, keycloak, etc.)
│   ├── modules/        # Feature modules (Hexagonal Architecture)
│   │   └── users/      # Example module (domain/application/infrastructure/presentation)
│   ├── shared/         # Cross-cutting code (auth guards, interceptors, pipes)
│   ├── health/         # Health check endpoints
│   └── main.ts         # Application entry point
├── prisma/
│   ├── schema.prisma   # Database schema
│   └── migrations/     # Database migrations
├── docs/               # Additional documentation
└── docker-compose.yaml # Docker services
```

---

## Next Steps

- **Architecture**: See [Hexagonal Architecture](./docs/hexagonal-architecture.md)
- **CQRS**: See [CQRS Guide](./docs/cqrs-guide.md)
- **Authentication**: See [Auth Module](./docs/auth-module.md)
- **Database**: See [Prisma Module](./docs/prisma-module.md)
- **Caching**: See [Cache Module](./docs/cache.md)
- **Rate Limiting**: See [Rate Limiting](./docs/rate-limit.md)
- **Response Handling**: See [Response Handling](./docs/BACKEND_RESPONSE_HANDLING.md)
- **Monitoring**: See [Monitoring](./docs/monitoring.md)
- **Testing**: See [Testing Guide](./docs/testing.md)

---

## Troubleshooting

### Docker Services Not Starting

Check if ports are already in use:
```bash
docker-compose ps
netstat -ano | findstr :5432  # Windows
lsof -i :5432                 # macOS/Linux
```

### Keycloak Connection Errors

1. Verify Keycloak is running: http://localhost:8080
2. Check realm name matches `.env`
3. Verify client secret is correct
4. See [Keycloak Setup Guide](./docs/keycloak-setup.md)

### Database Connection Errors

1. Check PostgreSQL is running: `docker-compose ps`
2. Verify `DATABASE_URL` in `.env`
3. Check Docker logs: `docker-compose logs postgres`

### Prisma Migration Errors

Reset the database (⚠️ WARNING: Deletes all data):
```bash
npx prisma migrate reset
```

---

## Development Workflow

1. **Make changes** to your code
2. **Run linting**: `npm run lint`
3. **Run tests**: `npm test`
4. **Commit changes**: Husky will run pre-commit checks automatically
5. **Push to repository**

---

## Additional Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Keycloak Documentation](https://www.keycloak.org/documentation)
