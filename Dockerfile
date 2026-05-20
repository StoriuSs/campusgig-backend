# ============================================================================
# Multi-Stage Dockerfile for NestJS Hexagonal Architecture
# ============================================================================
# Stages:
#   1. base        — Shared Node.js base with common system deps
#   2. deps        — Install ALL npm dependencies (dev + prod)
#   3. build       — Compile TypeScript and generate Prisma client
#   4. dev         — Development image (hot-reload, debugging, full deps)
#   5. prod        — Production image (minimal, distroless-like)
#
# Usage:
#   Dev:   docker build --target dev  -t nestapp:dev .
#   Prod:  docker build --target prod -t nestapp:prod .
# ============================================================================

# ----- STAGE 1: BASE -----
# Shared base with system-level dependencies needed by native modules (sharp, prisma)
FROM node:22-alpine AS base

# Required by sharp (image processing) and Prisma
RUN apk add --no-cache \
    libc6-compat \
    openssl

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# ----- STAGE 2: DEPENDENCIES -----
# Install all dependencies (dev + prod) so both dev and build stages can use them
FROM base AS deps

# Copy package files first for layer caching
COPY package.json pnpm-lock.yaml* ./

# Install ALL dependencies (need devDependencies for building)
RUN pnpm install --frozen-lockfile --ignore-scripts

# ----- STAGE 3: BUILD -----
# Compile TypeScript → JavaScript, generate Prisma client
FROM deps AS build

# Copy source code and config files needed for build
COPY src ./src
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY tsconfig.json tsconfig.build.json nest-cli.json ./

# Generate Prisma client
RUN DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy pnpm exec prisma generate

# Build the NestJS application
RUN pnpm run build

# ----- STAGE 4: DEVELOPMENT -----
# Full development environment with hot-reload, debugging, and all tools
FROM deps AS dev

# Copy everything needed for development
COPY . .

# Generate Prisma client for development
RUN DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy pnpm exec prisma generate

# Expose app port + debug port
EXPOSE 3000 9229

# Start with hot-reload
CMD ["pnpm", "run", "dev"]

# ----- STAGE 5: PRODUCTION -----
# Minimal image with only what's needed to run the compiled app.
#
# Key design: Prisma engines (~80MB) are baked in at build time, NOT
# downloaded at runtime. The build stage runs `prisma generate` against
# schema.prisma which declares `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]`,
# so the Alpine-compatible engine is materialized into the build stage's
# node_modules. We then copy the entire @prisma/engines tree into the
# prod stage so the runtime container is fully self-contained: no
# network access needed to start, no writable node_modules required.
FROM base AS prod

ENV NODE_ENV=production
# Tell Prisma which engine to load. Without this, Prisma auto-detects
# the platform — usually fine, but explicit beats implicit in prod.
ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install production dependencies ONLY. --ignore-scripts skips Prisma's
# postinstall (which would try to re-download engines into a fresh
# node_modules) — we copy them in from the build stage instead.
RUN pnpm install --prod --frozen-lockfile --ignore-scripts && pnpm store prune

# Copy compiled output from build stage
COPY --from=build /app/dist ./dist

# Copy generated Prisma client from build stage
COPY --from=build /app/generated ./generated

# Copy pre-downloaded Prisma engines from the build stage. This is what
# makes the prod image self-contained — no runtime download.
COPY --from=build /app/node_modules/@prisma/engines ./node_modules/@prisma/engines
COPY --from=build /app/node_modules/.pnpm/@prisma+engines* ./node_modules/.pnpm/

# Copy Prisma schema + migrations (needed for `prisma migrate deploy`)
COPY prisma ./prisma
COPY prisma.config.ts ./

# Copy Swagger docs if needed at runtime
COPY swagger-docs.yaml ./

# Create uploads directory with correct ownership.
# (We only chown the writable directories — node_modules stays root-owned
# and read-only, which is the secure default.)
RUN mkdir -p uploads && chown nestjs:nodejs uploads

# Switch to non-root user
USER nestjs

EXPOSE 3000

# Run migrations then start the app
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/main"]
