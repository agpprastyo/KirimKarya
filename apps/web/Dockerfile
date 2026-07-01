# apps/web/Dockerfile
FROM oven/bun:1.3-alpine AS base
WORKDIR /app

# ── deps stage ────────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json bun.lock ./
COPY apps/web/package.json apps/web/
COPY packages/env/package.json packages/env/
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

# ── runner stage: serve built static files with a minimal server ──────────────
FROM oven/bun:1.3-alpine AS runner
WORKDIR /app

COPY --from=builder /app/apps/web/build ./build
COPY --from=builder /app/apps/web/package.json ./

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3002/ || exit 1

CMD ["bun", "--env-file=/run/secrets/env", "x", "vite", "preview", "--host", "0.0.0.0", "--port", "3002"]
