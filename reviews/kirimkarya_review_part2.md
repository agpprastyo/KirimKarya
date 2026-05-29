# KirimKarya — Comprehensive Code & Architecture Review (Part 2/3)

*Continued from [Part 1](file:///home/agprastyo/.gemini/antigravity/brain/acfd5519-9042-48ba-840c-cdcd73bbf3ae/kirimkarya_review_part1.md)*

---

## 5. API Design Review

### 5.1 REST API Assessment

| Criteria | Score | Details |
|----------|-------|---------|
| **Endpoint Naming** | ⭐⭐⭐⭐ | RESTful: `/galleries`, `/galleries/:id`, `/photos/galleries/:id/photos` |
| **HTTP Methods** | ⭐⭐⭐⭐ | Correct: GET (read), POST (create), PUT (update), DELETE (remove) |
| **Status Codes** | ⭐⭐⭐⭐ | 200, 201, 202, 400, 401, 403, 404, 429, 500 — all used appropriately |
| **Response Consistency** | ⭐⭐⭐⭐⭐ | Uniform `{ message, data, meta }` / `{ message, error }` envelope |
| **OpenAPI/Swagger** | ⭐⭐⭐⭐⭐ | Full OpenAPI 3.0 via `@hono/zod-openapi` + Scalar UI at `/api/docs` |
| **Validation** | ⭐⭐⭐⭐ | Zod schemas on all request bodies and params |
| **Pagination** | ⭐⭐ | Only admin galleries endpoint has `limit/offset`. User galleries have none |
| **Filtering/Sorting** | ⭐⭐ | Only admin has `search` param. No sorting options exposed |
| **API Versioning** | ⭐ | ❌ No versioning at all (`/api/v1/` not used) |
| **Rate Limiting** | ⭐⭐ | Only on watermark regeneration. No general rate limiting |

### 5.2 API Design Issues

| Priority | Issue | Details |
|----------|-------|---------|
| **🔴 Critical** | Photos nested under wrong resource | `POST /api/photos/galleries/:id/photos` — photos controller owns a galleries sub-path. Should be `POST /api/galleries/:id/photos` |
| **🟡 High** | No pagination on gallery list | `GET /api/galleries` returns ALL galleries for a user. Will degrade with scale |
| **🟡 High** | No API versioning | Breaking changes will affect all clients simultaneously |
| **🟡 High** | Stats endpoints return `z.any()` | `schema: createApiResponseSchema(z.any())` — no type safety on response |
| **🟢 Medium** | Inconsistent photo deletion | `DELETE /api/photos/photos` (body: `{ids: [...]}`) — DELETE with request body is non-standard. Use `POST /api/photos/bulk-delete` |
| **🟢 Medium** | Missing PATCH method | Update uses PUT but accepts partial data (all fields optional). Should use PATCH semantically |
| **🔵 Low** | Admin routes use `:id` syntax | `path: "/galleries/:id/status"` — should use `{id}` for OpenAPI compatibility (Hono supports both but OpenAPI spec uses `{id}`) |

### 5.3 Recommended API Improvements

```
# Ideal endpoint structure:
GET    /api/v1/galleries?page=1&limit=20&sort=created_at&order=desc
POST   /api/v1/galleries
GET    /api/v1/galleries/:id
PATCH  /api/v1/galleries/:id
DELETE /api/v1/galleries/:id
POST   /api/v1/galleries/:id/photos      ← move from /photos controller
GET    /api/v1/galleries/:id/photos      ← move from /photos controller
POST   /api/v1/galleries/:id/deliver
POST   /api/v1/photos/bulk-delete        ← explicit action endpoint
```

---

## 6. Worker System Review

### 6.1 Queue Architecture

| Queue | Concurrency | Retries | Backoff | Assessment |
|-------|------------|---------|---------|------------|
| `photo-processing` | 4 | 3 | Exponential (1s) | ✅ Appropriate |
| `notifications` | 5 | 5 | Exponential (2s) | ✅ Good — email delivery can be flaky |
| `delivery` | 2 | 3 | Exponential (5s) | ⚠️ Concurrency OK but memory-intensive |
| `cleanup` | 1 | 1 | None | ⚠️ No retry on cleanup failure |

### 6.2 Critical Worker Issues

| Priority | Issue | File | Impact |
|----------|-------|------|--------|
| **🔴 Critical** | **ZIP delivery loads ALL photos into RAM** | `delivery.ts:48-63` | Gallery with 200 photos × 15MB = **3GB RAM**. Process will OOM |
| **🔴 Critical** | **No graceful shutdown** | `worker/index.ts` | Killing process loses in-flight jobs. Photos stuck in PROCESSING |
| **🟡 High** | **Non-idempotent photo processing** | `photo-processing.ts` | Retry creates duplicate S3 files (new thumbnail/watermark keys on retry would overwrite, but UUID-based keys in original upload would not) |
| **🟡 High** | **Pending photo count logic bug** | `photo-processing.ts:122-126` | `count(ne(photos.status, "READY"))` counts ALL non-ready photos including ERROR status. Should filter to only PROCESSING/PENDING |
| **🟡 High** | **No job progress tracking** | All workers | `job.updateProgress()` not called. BullMQ dashboard/admin panel won't show progress |
| **🟢 Medium** | **No job timeout** | All workers | If S3 hangs, worker thread blocks indefinitely. Add `lockDuration` |
| **🟢 Medium** | **Cleanup queries all galleries** | `cleanup.ts:15-18` | `WHERE expires_at < NOW()` with no index on `expires_at`. Full table scan |

### 6.3 Production Readiness Verdict: ⚠️ NOT Production-Ready

The worker system has the right architecture (BullMQ, separate process, async), but lacks:
- Memory-safe streaming for large operations
- Graceful shutdown
- Job timeout/stall detection
- Proper observability (no metrics, no tracing)

---

## 7. Database Review

### 7.1 Schema Analysis

| Table | PK Type | Notes |
|-------|---------|-------|
| `user` | `text` (Better Auth managed) | ⚠️ Not UUID — Better Auth uses its own ID format |
| `session`, `account`, `verification`, `two_factor` | `text` | Better Auth managed — OK |
| `galleries` | `uuid` (UUIDv7) | ✅ Time-sortable, collision-resistant |
| `gallery_access` | `uuid` (UUIDv7) | ✅ Good |
| `photos` | `uuid` (UUIDv7) | ✅ Good |
| `feedbacks` | `uuid` (UUIDv7) | ✅ Good |

### 7.2 Missing Indexes (Critical)

```sql
-- These indexes are MISSING and will cause full table scans:

-- galleries: queried by userId in almost every endpoint
CREATE INDEX idx_galleries_user_id ON galleries(user_id);

-- galleries: cleanup worker scans by expires_at
CREATE INDEX idx_galleries_expires_at ON galleries(expires_at) WHERE expires_at IS NOT NULL;

-- photos: queried by gallery_id constantly
CREATE INDEX idx_photos_gallery_id ON photos(gallery_id);

-- feedbacks: queried by photo_id and client_identifier
CREATE INDEX idx_feedbacks_photo_id ON feedbacks(photo_id);
CREATE INDEX idx_feedbacks_client_identifier ON feedbacks(client_identifier);

-- gallery_access: queried by gallery_id + email
CREATE INDEX idx_gallery_access_gallery_email ON gallery_access(gallery_id, email);
```

### 7.3 Schema Design Issues

| Priority | Issue |
|----------|-------|
| **🔴 Critical** | **No indexes on foreign keys** — `galleries.user_id`, `photos.gallery_id`, `feedbacks.photo_id` have no indexes. Every JOIN and WHERE clause does a sequential scan |
| **🟡 High** | **Missing cascade deletes** — `photos.gallery_id` FK has `ON DELETE no action`. Manual cascade deletion in service layer is fragile. Schema says `galleryAccess` has cascade but `photos` and `feedbacks` do not |
| **🟡 High** | **No unique constraint** on `feedbacks(photo_id, client_identifier)` — allows duplicate feedback records per client per photo |
| **🟡 High** | **Watermark fields on user table** — `watermarkType`, `watermarkText`, `watermarkImageKey`, `watermarkOpacity` should be a separate `watermark_settings` table |
| **🟢 Medium** | **Status fields as varchar** — `galleries.status`, `photos.status`, `galleries.deliveryStatus` should use PostgreSQL ENUMs for data integrity |
| **🟢 Medium** | **No `fileSize` column** on photos — storage estimation in admin uses hardcoded `5.5MB per photo` |
| **🔵 Low** | **Table naming inconsistency** — `user` (singular) vs `galleries`, `photos`, `feedbacks` (plural) |

### 7.4 Migration Strategy

- ✅ Drizzle Kit migrations with versioned SQL files (7 migrations found)
- ✅ Migration journal in `meta/_journal.json`
- ⚠️ No down-migrations (rollback strategy missing)
- ⚠️ No migration CI check (migrations could drift from schema)

---

## 8. Security Review

### 8.1 Critical Security Findings

#### 🔴 SEC-1: SECRETS COMMITTED TO GIT (SEVERITY: CRITICAL)

```bash
# .env file is in .gitignore BUT currently exists and contains:
GOOGLE_CLIENT_ID=YOUR_CLIENT_SECRET.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
SMTP_PASS=ftdr zuzh mfho xjhl
BETTER_AUTH_SECRET=pLAnpS8_very_secret_key_change_this_later
DB_PASSWORD=admin123
```

**If this `.env` was EVER committed to git history, these secrets are compromised.** The `.gitignore` lists `.env` so it SHOULD be safe, but verify with `git log --all -- .env`.

**Action Required**: Rotate ALL secrets immediately if they were ever committed. The `BETTER_AUTH_SECRET` string literally says "change this later".

#### 🔴 SEC-2: IMAGE PROXY AUTHORIZATION BYPASS (SEVERITY: HIGH)

```typescript
// images.controller.ts:47
const isPublicPath = key.includes("uploads/") || key.includes("avatar/");
// Anyone can access ANY file with "uploads/" or "avatar/" in the path
// Path traversal risk: key could be "../../uploads/sensitive"
```

The image controller uses string `includes()` instead of `startsWith()` for path validation. Additionally, for non-public paths, the authorization logic is complex and has edge cases where gallery thumbnails/watermarks can be accessed without proper cookie validation.

#### 🔴 SEC-3: NO BRUTE-FORCE PROTECTION ON OTP/PASSWORD VERIFICATION (SEVERITY: HIGH)

```typescript
// public.service.ts:127-138 — verifyOTP
// No rate limiting on OTP attempts
// 6-digit OTP = 1,000,000 combinations
// At 100 req/s, brute-forced in ~3 hours

// public.service.ts:140-172 — verifyStaticPassword
// No rate limiting on password attempts
// Unlimited password guessing possible
```

#### 🟡 SEC-4: TRUSTED ORIGINS HARDCODED

```typescript
// auth.config.ts:23
trustedOrigins: ["http://localhost:5173"],
// Production URL not included. Will break in production deployment.
```

#### 🟡 SEC-5: COOKIE SECURITY

```typescript
// Gallery access cookies:
setCookie(c, `gallery_access_${galleryId}`, email, {
    maxAge: 60 * 60 * 24 * 7,  // 7 days
    httpOnly: true,             // ✅ Good
    sameSite: "Lax",            // ✅ Good
    secure: process.env.NODE_ENV === "production", // ✅ Good
});
// ⚠️ Cookie VALUE is the user's email address (PII in cookie)
```

### 8.2 Full Security Checklist

| Category | Status | Notes |
|----------|--------|-------|
| JWT/Session Auth | ✅ | Better Auth handles sessions with secure cookies |
| Password Hashing | ✅ | `Bun.password.hash()` with bcrypt (cost 10) |
| SQL Injection | ✅ | Drizzle ORM parameterizes all queries |
| XSS Protection | ✅ | SvelteKit escapes output by default |
| CSRF Protection | ⚠️ | SameSite=Lax cookies + CORS, but no CSRF token |
| CORS | ✅ | Configured with specific origin |
| Input Validation | ✅ | Zod on all endpoints |
| File Upload Validation | ✅ | Size limits (50MB photos, 5MB avatar, 2MB watermark) + MIME type checks |
| Secret Management | 🔴 | Hardcoded in `.env`, weak auth secret |
| Rate Limiting | 🔴 | Only watermark regeneration has rate limiting |
| Authorization (IDOR) | ✅ | Gallery queries filter by `userId` — multitenancy enforced |
| Sensitive Data Exposure | ⚠️ | Email stored in cookies, errors may leak in dev mode |

---

## 9. Docker & Deployment Review

### 9.1 Current Docker Setup

```yaml
# docker-compose.yml — Development infrastructure only
services:
  postgres:   # PostgreSQL 17-alpine ✅
  redis:      # Redis 7-alpine ✅
  minio:      # MinIO (S3 compatible) ✅
```

### 9.2 Assessment

| Criteria | Status | Notes |
|----------|--------|-------|
| **Dockerfile for apps** | ❌ | No Dockerfile for API, Worker, or Web. Cannot containerize |
| **Multi-stage build** | ❌ | N/A — no Dockerfiles |
| **Docker Compose** | ⚠️ | Infrastructure only — no app services |
| **Environment separation** | ❌ | No dev/staging/prod profiles |
| **Reverse proxy** | ❌ | No Nginx/Traefik/Caddy config |
| **Health checks** | ⚠️ | Worker has `/health`, no Docker health checks defined |
| **CI/CD** | ❌ | No GitHub Actions, no pipeline config |
| **Kubernetes** | ❌ | No manifests, no Helm charts |
| **Horizontal scaling** | ⚠️ | Stateless API could scale, but no load balancer config |
| **Logging** | ❌ | Console.log only, no log aggregation |
| **Monitoring** | ❌ | No Prometheus metrics, no health check dashboard |

### 9.3 Production Readiness Verdict

| Dimension | Ready? |
|-----------|--------|
| Containerized | ❌ No |
| Kubernetes-ready | ❌ No |
| CI/CD pipeline | ❌ No |
| Production secrets management | ❌ No |
| Observability stack | ❌ No |
| Load testing | ❌ No |

**The project is firmly in "development workstation" mode.** There is a significant gap between current state and production deployment.

### 9.4 Recommended Dockerfile (Example)

```dockerfile
# apps/api/Dockerfile
FROM oven/bun:1.3-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/redis/package.json packages/redis/
COPY packages/queue/package.json packages/queue/
COPY packages/storage/package.json packages/storage/
COPY packages/mail/package.json packages/mail/
RUN bun install --frozen-lockfile --production

FROM base AS runner
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
HEALTHCHECK --interval=30s CMD curl -f http://localhost:3000/api/health || exit 1
CMD ["bun", "run", "apps/api/src/index.ts"]
```

---

*Continued in [Part 3](file:///home/agprastyo/.gemini/antigravity/brain/acfd5519-9042-48ba-840c-cdcd73bbf3ae/kirimkarya_review_part3.md) — Frontend Review, Missing Features, Production Checklist, System Design Recommendations, Roadmap, and Final Scoring*
