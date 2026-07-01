# apps/api/Dockerfile
FROM oven/bun:1.3-alpine AS base
WORKDIR /app

# Install dependencies for native modules (sharp)
RUN apk add --no-cache python3 make g++ vips-dev

# ── deps stage: install all workspace dependencies ──────────────────────────
FROM base AS deps
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/env/package.json packages/env/
COPY packages/mail/package.json packages/mail/
COPY packages/queue/package.json packages/queue/
COPY packages/redis/package.json packages/redis/
COPY packages/storage/package.json packages/storage/
RUN bun install --frozen-lockfile

# ── runner stage ─────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

# Copy source code
COPY apps/api ./apps/api
COPY packages ./packages
COPY tsconfig.json ./

WORKDIR /app/apps/api

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["bun", "run", "src/index.ts"]
