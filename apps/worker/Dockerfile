# apps/worker/Dockerfile
FROM oven/bun:1.3-alpine AS base
WORKDIR /app

# Install native build tools (sharp, archiver)
RUN apk add --no-cache python3 make g++ vips-dev

# ── deps stage ────────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json bun.lock ./
# Copy all workspace app package.json files (all required by bun for lockfile resolution)
COPY apps/worker/package.json apps/worker/
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY apps/e2e/package.json apps/e2e/
COPY packages/db/package.json packages/db/
COPY packages/env/package.json packages/env/
COPY packages/mail/package.json packages/mail/
COPY packages/observability/package.json packages/observability/
COPY packages/queue/package.json packages/queue/
COPY packages/redis/package.json packages/redis/
COPY packages/storage/package.json packages/storage/
RUN bun install --frozen-lockfile

# ── runner stage ─────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules

COPY apps/worker ./apps/worker
COPY packages ./packages
COPY tsconfig.json ./

WORKDIR /app/apps/worker

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["bun", "run", "src/index.ts"]
