# apps/web/Dockerfile
FROM oven/bun:1.3-alpine AS base
WORKDIR /app

# ── deps stage ────────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json bun.lock ./
# Copy all workspace app package.json files (all required by bun for lockfile resolution)
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/e2e/package.json apps/e2e/

# Copy all required packages
COPY packages/env/package.json packages/env/
COPY packages/observability/package.json packages/observability/
COPY packages/db/package.json packages/db/
COPY packages/mail/package.json packages/mail/
COPY packages/queue/package.json packages/queue/
COPY packages/redis/package.json packages/redis/
COPY packages/storage/package.json packages/storage/

RUN bun install --frozen-lockfile

# ── build stage ───────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

COPY apps/web ./apps/web
COPY packages ./packages
COPY tsconfig.json ./

WORKDIR /app/apps/web

# Build args are baked into the static bundle at build time
ARG PUBLIC_API_URL=http://localhost:3000
ARG PUBLIC_WEB_URL=http://localhost:5173
ENV PUBLIC_API_URL=$PUBLIC_API_URL
ENV PUBLIC_WEB_URL=$PUBLIC_WEB_URL

RUN bun run build

# ── runner stage: serve with adapter-node generated server ───────────────────
FROM oven/bun:1.3-alpine AS runner
WORKDIR /app

COPY --from=builder /app/apps/web/build ./build
COPY --from=builder /app/apps/web/package.json ./
COPY --from=deps /app/node_modules ./node_modules

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3002/ || exit 1

# adapter-node outputs a standalone server at build/index.js
# PORT env var controls the listening port
ENV PORT=3002
CMD ["bun", "--env-file=/run/secrets/env", "run", "build/index.js"]
