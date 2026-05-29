# KirimKarya — Comprehensive Code & Architecture Review (Part 1/3)

> **Review Perspective**: Senior Backend Engineer · Staff Engineer · Software Architect · Tech Lead
> **Codebase Size**: ~15,700 lines across 4 apps + 5 shared packages
> **Stack**: Bun Runtime · Hono.js · SvelteKit 5 · PostgreSQL · Drizzle ORM · BullMQ · Redis · S3 · Better Auth

---

## 1. Architecture & System Design

### 1.1 Current Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│  ┌─────────────────┐              ┌──────────────────────────┐   │
│  │  SvelteKit Web  │◄── hc() ───►│   Hono API (port 3000)   │   │
│  │  (port 5173)    │              │   /api/*                 │   │
│  └─────────────────┘              └──────────┬───────────────┘   │
│                                              │                   │
├──────────────────────────────────────────────┼───────────────────┤
│                    INFRASTRUCTURE            │                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐   │                   │
│  │PostgreSQL│  │  Redis   │  │  MinIO   │   │                   │
│  │  (5432)  │  │  (6379)  │  │(9000/01) │   │                   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘   │                   │
│       │              │             │         │                   │
├───────┼──────────────┼─────────────┼─────────┼───────────────────┤
│       │              │             │         │                   │
│  ┌────▼──────────────▼─────────────▼─────────▼───────────────┐   │
│  │              Worker Process (port 3001)                    │   │
│  │  ┌──────────────┐ ┌──────────┐ ┌─────────┐ ┌──────────┐  │   │
│  │  │ Photo Proc.  │ │ Notif.   │ │Delivery │ │ Cleanup  │  │   │
│  │  │ (concur: 4)  │ │(concur:5)│ │(concur:2│ │(concur:1)│  │   │
│  │  └──────────────┘ └──────────┘ └─────────┘ └──────────┘  │   │
│  └───────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘

Shared Packages (Bun Workspaces):
  @kirimkarya/db      → Drizzle schema + connection
  @kirimkarya/redis   → Bun native RedisClient
  @kirimkarya/queue   → BullMQ queue definitions
  @kirimkarya/storage → Bun native S3Client
  @kirimkarya/mail    → Nodemailer + HTML templates
```

### 1.2 Architecture Classification

| Criteria | Assessment |
|----------|-----------|
| **Pattern** | **Modular Monolith** (with clear process separation) |
| **Coupling** | **Medium** — shared packages provide good abstraction, but `apps/api` and `apps/worker` share the same DB schema, queue types, and storage client directly |
| **Communication** | Async (BullMQ/Redis queues) between API → Worker. No sync inter-service calls |
| **Data Ownership** | Single PostgreSQL database (no per-service schema isolation) |
| **Deployment** | Separate processes but **NOT** independently deployable microservices |

**Verdict**: This is a well-designed **modular monolith** with proper async job offloading. This is the **correct architecture choice** for the current stage. The project is NOT a distributed monolith (no sync inter-service HTTP calls) and should NOT be forced into microservices prematurely.

### 1.3 Request & Background Job Flow

```
UPLOAD FLOW:
  Client → POST /api/photos/galleries/:id/photos
    → Validate auth + gallery ownership
    → Buffer file into ArrayBuffer ⚠️ (blocks RAM)
    → Upload to S3 (original/)
    → Insert DB record (status: PENDING → PROCESSING)
    → Enqueue BullMQ job "process-photo"
    → Return 202 Accepted

PROCESSING FLOW (Worker):
  Worker picks job from "photo-processing" queue
    → Download original from S3
    → Generate 400x400 thumbnail (sharp)
    → Generate 1200x1200 watermarked preview (sharp + SVG overlay)
    → Upload both to S3
    → Update DB (status: READY)
    → If all gallery photos READY → enqueue "PHOTOS_READY" notification

DELIVERY FLOW:
  Studio → POST /api/galleries/:id/deliver
    → Enqueue delivery job
  Worker:
    → Download all selected originals from S3
    → Package into ZIP (JSZip in-memory) ⚠️
    → Upload ZIP to S3
    → Email clients with download link
```

### 1.4 Scalability Assessment

| Dimension | Current | Rating |
|-----------|---------|--------|
| Horizontal API scaling | ❌ No sticky sessions needed (stateless), but single process | ⚠️ Medium |
| Worker scaling | ⚠️ Single worker process, BullMQ supports multiple | ⚠️ Medium |
| Database scaling | ❌ Single PG, no read replicas, no connection pooling | ⚠️ Low |
| Storage | ✅ S3-compatible (MinIO/R2) — horizontally scalable | ✅ Good |
| Queue | ✅ Redis-backed BullMQ — production-proven | ✅ Good |
| Caching | ⚠️ Redis available but barely used (only OTP + cooldown) | ⚠️ Low |

### 1.5 Architecture Improvement Recommendations

| Priority | Recommendation |
|----------|---------------|
| **🔴 Critical** | Upload handler buffers entire file into `ArrayBuffer` in RAM (line 242 photos.controller.ts). Use streaming upload for large files |
| **🔴 Critical** | ZIP delivery loads ALL selected originals into memory simultaneously (delivery.ts). Will OOM on large galleries |
| **🟡 High** | Add Redis caching for public gallery metadata (as specified in design doc but not implemented) |
| **🟡 High** | Add database connection pooling (current: raw `postgres()` with no pool config) |
| **🟢 Medium** | Extract image proxy into a CDN/edge function instead of proxying through Hono |
| **🟢 Medium** | Add circuit breaker for S3 operations in workers |

---

## 2. Folder Structure & Monorepo Organization

### 2.1 Current Structure

```
KirimKarya/
├── apps/
│   ├── api/           # Hono backend (29 source files)
│   │   └── src/
│   │       ├── core/         # Middlewares, exceptions, types
│   │       ├── modules/      # Feature modules (auth, galleries, photos, etc.)
│   │       ├── lib/          # Shared utilities (response helpers)
│   │       └── scripts/      # Seed scripts
│   ├── worker/        # BullMQ workers (7 source files)
│   │   └── src/
│   │       └── workers/      # Individual worker files
│   ├── web/           # SvelteKit frontend (~70 source files)
│   │   └── src/
│   │       ├── routes/       # SvelteKit file-based routing
│   │       └── lib/          # Components, API client, utilities
│   └── e2e/           # Playwright E2E tests
├── packages/
│   ├── db/            # Drizzle schema + migrations
│   ├── redis/         # Redis client wrapper
│   ├── queue/         # BullMQ queue definitions + types
│   ├── storage/       # S3 client wrapper
│   └── mail/          # Email service + templates
├── design/            # Architecture docs (high-level.md, low-level.md)
├── docker-compose.yml # Dev infrastructure
├── Makefile           # Dev commands
└── package.json       # Bun workspace root
```

### 2.2 Assessment

| Criteria | Score | Notes |
|----------|-------|-------|
| **Separation of Concerns** | ⭐⭐⭐⭐ | Clean split: apps vs packages. Feature modules in API well-organized |
| **Naming Convention** | ⭐⭐⭐ | Mostly consistent but mixed: `stats-service.ts` vs `galleries.service.ts` (hyphen vs dot) |
| **Dependency Coupling** | ⭐⭐⭐ | Packages are thin wrappers. Good. But API imports `drizzle-orm` operators directly from `@kirimkarya/db` which leaks ORM implementation |
| **Team Scalability** | ⭐⭐⭐⭐ | Module-based API structure allows parallel development. Each module is self-contained |
| **Clean Structure** | ⭐⭐⭐⭐ | One of the project's strongest points |

### 2.3 Issues Found

| Priority | Issue |
|----------|-------|
| **🟡 High** | Module naming inconsistency: `stats-service.ts` / `stats-controller.ts` (hyphenated) vs `galleries.service.ts` / `galleries.controller.ts` (dotted). Pick ONE convention |
| **🟡 High** | `packages/db/src/index.ts` re-exports raw Drizzle operators (`eq`, `and`, `sql`, etc.). This leaks the ORM abstraction — consumers should not need to know about Drizzle |
| **🟢 Medium** | No `packages/db/src/repositories/` layer — all raw Drizzle queries live in service files. This violates Repository Pattern |
| **🟢 Medium** | API modules lack consistent structure. Some have schema files (`galleries.schema.ts`), others don't (`watermark/`, `admin/`). Standardize to: `*.controller.ts`, `*.service.ts`, `*.schema.ts`, `*.types.ts` |
| **🔵 Low** | `apps/web/src/lib/api/client.ts` uses relative path `../../../../api/src/index` to import API types. This creates a fragile cross-app dependency |

---

## 3. Code Quality Review

### 3.1 Strengths ✅

| Area | Details |
|------|---------|
| **OpenAPI Integration** | Every route uses `createRoute()` with Zod schemas → auto-generated API docs. Excellent |
| **Type Safety** | End-to-end type safety: Drizzle schema → Zod validation → Hono RPC client (`hc<AppType>`) |
| **Error Handling** | Centralized `errorHandler` middleware handles ZodError, HttpError, and uncaught exceptions cleanly |
| **Response Consistency** | `apiResponse.success()` / `apiResponse.error()` ensures uniform response shape across all endpoints |
| **Queue Architecture** | BullMQ with exponential backoff, retry policies, and `removeOnFail: false` for debugging |
| **Auth Implementation** | Better Auth with Drizzle adapter, 2FA, Google OAuth, email verification — comprehensive |
| **Async Processing** | Heavy tasks (image processing, ZIP packaging, email) correctly offloaded to workers |
| **S3 Asset Cleanup** | Gallery deletion cascades to S3 cleanup (async, non-blocking) |
| **Watermark System** | Dynamic watermark with user-configurable text/image, opacity, grid pattern — impressive feature |

### 3.2 Code Smells & Anti-Patterns 🔴

#### CS-1: `any` Type Abuse (Critical)
```typescript
// galleries.service.ts:54
async create(userId: string, data: any) {  // ← loses all type safety

// galleries.service.ts:102
async update(id: string, userId: string, data: any) {  // ← same issue

// public.controller.ts:4
const api = clientApi as any;  // ← frontend casting to any
```
**Impact**: Defeats the purpose of the entire Zod + TypeScript pipeline. Bugs will slip through.
**Fix**: Use Zod's `z.infer<typeof CreateGallerySchema>` to derive types.

#### CS-2: Missing Transaction Boundaries (Critical)
```typescript
// galleries.service.ts:63-89 — CREATE
const [newGallery] = await db.insert(galleries)...  // Step 1
await db.insert(galleryAccess)...                   // Step 2
// If Step 2 fails, Step 1 is committed → orphaned gallery

// galleries.service.ts:149-186 — DELETE
await db.delete(feedbacks)...   // Step 1
await db.delete(photos)...      // Step 2
await db.delete(galleryAccess)  // Step 3
await db.delete(galleries)...   // Step 4
// No transaction! Partial deletes possible
```
**Fix**: Wrap multi-table operations in `db.transaction()`.

#### CS-3: N+1 Query Pattern (High)
```typescript
// galleries.service.ts:13-23 — listByUserId
const enhancedList = await Promise.all(list.map(async (gallery) => {
    const selectionCount = await this.countSelectedPhotos(gallery.id);
    // ← One extra DB query PER gallery!
}));

// admin.controller.ts:669-688 — getAdminGalleries
const galleriesWithPhotoCount = await Promise.all(
    rawGalleries.map(async (row) => {
        const [photoCountResult] = await db.select({ count: count() })...
        // ← One extra query PER gallery!
    })
);
```
**Fix**: Use SQL subqueries or `LEFT JOIN` with `GROUP BY` to fetch counts in a single query.

#### CS-4: Duplicate Auth Check in Middleware + Handler (Medium)
```typescript
// Admin middleware already checks role === "admin"
// But every admin handler ALSO checks:
if (!userDetails || userDetails.role !== "admin") {
    return c.json(apiResponse.error("Forbidden"), 403);
}
// This is redundant — trust your middleware
```

#### CS-5: Untyped `data` Field in Queue Payloads (Medium)
```typescript
// queue/index.ts
export interface NotificationJobData {
    type: NotificationType;
    data?: any;  // ← any! What shape is this?
}
```

#### CS-6: Console.log as Logging (Medium)
The entire codebase uses raw `console.log/error/warn` with manual formatting like `[AuthMiddleware]`, `[Job ${job.id}]`. No structured logging, no log levels, no correlation IDs.

### 3.3 SOLID Principles Assessment

| Principle | Score | Notes |
|-----------|-------|-------|
| **S** — Single Responsibility | ⭐⭐⭐ | Services mix business logic with DB queries. Controllers are clean |
| **O** — Open/Closed | ⭐⭐⭐ | Queue types use discriminated union (good), but notification worker uses switch-case that must be modified for new types |
| **L** — Liskov Substitution | N/A | No inheritance used (this is fine) |
| **I** — Interface Segregation | ⭐⭐ | No interfaces at all. Services are concrete classes with no contracts |
| **D** — Dependency Inversion | ⭐⭐ | Services directly import `db`, `s3`, `redis` singletons. No DI, no testability |

### 3.4 Testing Strategy Assessment

| Layer | Status | Impact |
|-------|--------|--------|
| **Unit Tests** | ❌ None | 🔴 Critical gap |
| **Integration Tests** | ❌ None | 🔴 Critical gap |
| **E2E Tests** | ⚠️ 1 test file, basic happy path | 🟡 Minimal coverage |
| **API Contract Tests** | ❌ None | 🟡 High risk for breaking changes |

---

## 4. TypeScript & Bun Best Practices Review

### 4.1 Environment & Configuration

| Practice | Status | Notes |
|----------|--------|-------|
| Zod env validation | ✅ | Every app/package validates env with Zod |
| Central .env | ✅ | Root `.env` resolved by all apps |
| Type-safe config | ✅ | `envSchema.parse(process.env)` |
| Env separation (dev/prod) | ⚠️ | No `.env.production`, no env profiles |
| Dotenv double-loading | ⚠️ | Both `dotenv.config()` AND `bun --env-file=` in Makefile |

### 4.2 Error Handling Patterns

| Practice | Status |
|----------|--------|
| Custom HttpError class | ✅ Good |
| Centralized error handler | ✅ Good |
| Zod validation errors formatted | ✅ Good |
| Stack trace hidden in production | ✅ Good |
| Error wrapping with context | ❌ Missing — errors thrown without wrapping lose context |
| Async error propagation in workers | ⚠️ Partial — some `.catch(() => {})` silently swallow errors |

### 4.3 Middleware & Auth Patterns

| Practice | Status | Notes |
|----------|--------|-------|
| Path-based auth middleware | ✅ | Clean pattern: `app.use("/galleries/*", authMiddleware)` |
| Session-based auth (cookie) | ✅ | Better Auth handles cookies properly |
| Admin role middleware | ✅ | Separate middleware for admin routes |
| Rate limiting | ⚠️ | Only on watermark regeneration. No general rate limiter |
| Request ID propagation | ⚠️ | `requestId()` middleware added but never used in logs |
| CORS configuration | ✅ | Properly configured with specific origin |

### 4.4 Graceful Shutdown

**Status**: ❌ **Missing entirely**

Neither the API server nor the Worker process implements graceful shutdown. If a worker is processing a photo and the process is killed:
- The photo will be stuck in `PROCESSING` status forever
- The BullMQ job will be lost (stalled, eventually retried)

```typescript
// MISSING — should be in worker/src/index.ts:
process.on("SIGTERM", async () => {
    await Promise.all(workers.map(w => w.close()));
    process.exit(0);
});
```

### 4.5 Worker Patterns Assessment

| Pattern | Status | Notes |
|---------|--------|-------|
| Concurrency limits | ✅ | Each worker has appropriate concurrency |
| Retry with backoff | ✅ | Exponential backoff configured |
| Job idempotency | ❌ | Photo processing is NOT idempotent — retries create duplicate S3 keys |
| Dead letter queue | ⚠️ | `removeOnFail: false` keeps failed jobs, but no DLQ routing |
| Scheduled jobs | ✅ | Cleanup runs hourly via cron |
| Health endpoint | ✅ | Worker has `/health` endpoint |
| Memory management | ❌ | ZIP delivery loads all photos into memory simultaneously |

---

*Continued in [Part 2](file:///home/agprastyo/.gemini/antigravity/brain/acfd5519-9042-48ba-840c-cdcd73bbf3ae/kirimkarya_review_part2.md) — API Design, Worker System, Database, Security*
