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

# Enable pnpm via corepack. Version is pinned via `packageManager` in
# package.json — corepack reads that file and activates the right pnpm
# version automatically when you `corepack enable`. Keeping host (Windows
# dev) and container (Alpine prod) on the same pnpm version prevents the
# entire class of "build works locally but not in Docker" bugs.
RUN corepack enable

WORKDIR /app

# ----- STAGE 2: DEPENDENCIES -----
# Install all dependencies (dev + prod) so both dev and build stages can use them
FROM base AS deps

# Copy package files first for layer caching
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml .npmrc ./

# Install ALL dependencies (need devDependencies for building).
# --ignore-scripts is fine here because this stage only needs source code
# to compile, not native bindings. The prod stage installs separately
# with --allow-build flags for the packages that actually need scripts.
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
# Prisma engines are materialized into the image at build time, not at
# runtime, via two paths:
#  1. The pnpm install step runs Prisma's postinstall, which downloads
#     the migration engine into node_modules/prisma/ (used by the CMD
#     to run `prisma migrate deploy`).
#  2. The build stage's `prisma generate` produces the query engine
#     alongside the generated client at /app/generated/prisma/, which
#     we copy below.
# Both happen at build time, so the runtime container never needs to
# download anything from Prisma's CDN.
FROM base AS prod

ENV NODE_ENV=production
# Tell Prisma which engine to load. Without this, Prisma auto-detects
# the platform — usually fine, but explicit beats implicit in prod.
ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy package files
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml .npmrc ./

# Install production dependencies ONLY.
#
# pnpm v9+ ignores install scripts by default. The list of packages
# allowed to run scripts is committed in pnpm-workspace.yaml (under
# `onlyBuiltDependencies`), and approval is committed in the same file
# via `pnpm approve-builds <pkgs>` (run once on a dev machine).
# See docs/supply-chain-and-install-scripts.md for details.
RUN pnpm install --prod --frozen-lockfile && pnpm store prune

# Copy compiled output from build stage
COPY --from=build /app/dist ./dist

# Copy generated Prisma client + engines from build stage.
# Because schema.prisma sets `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]`
# and `output = "../generated/prisma"`, the Alpine-compatible query engine
# binary is produced alongside the client code in /app/generated/prisma/.
# Copying this directory makes the prod image fully self-contained — no
# runtime engine download needed.
COPY --from=build /app/generated ./generated

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
