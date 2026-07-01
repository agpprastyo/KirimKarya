# Design Specification: TypeScript Hardening & Test Coverage Expansion

This document details the architectural design and refactoring plan for eliminating `any` casting from production code, standardizing type declarations, and expanding automated unit and integration tests.

## 1. Objectives & Scope

- **Type Safety Reinforcement**: Remove all `any` declarations in production code and replace them with strong types or safe `unknown` fallbacks.
- **Core Logger Typing**: Define typed schemas for the structured context and errors handled by the core logger.
- **Queue and Job Typing**: Refactor the BullMQ handlers inside the admin module to use natively exported BullMQ `Queue` and `Job` types.
- **Write New Test Suites**: Implement unit tests for the core logger and integration tests for the admin endpoints.

---

## 2. Refactoring Design

### 2.1 Core Logger Refactoring

In [logger.ts](file:///home/agprastyo/Developments/KirimKarya/apps/api/src/core/logger.ts), we replace `any` with precise context types:

```typescript
export interface LogContext {
    requestId?: string;
    userId?: string;
    galleryId?: string;
    method?: string;
    url?: string;
    status?: number;
    durationMs?: number;
    [key: string]: unknown;
}
```

The error formatter will be refactored to consume `unknown` and format errors using safe type guards:

```typescript
private formatError(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
        };
    }
    return { message: String(error) };
}
```

### 2.2 Response Utility & Middlewares

- In [response.ts](file:///home/agprastyo/Developments/KirimKarya/apps/api/src/lib/response.ts), type metadata as `Record<string, unknown>` and error details as `unknown`.
- In [index.ts](file:///home/agprastyo/Developments/KirimKarya/apps/api/src/index.ts) and [error-handler.ts](file:///home/agprastyo/Developments/KirimKarya/apps/api/src/core/middlewares/error-handler.ts), change try-catch parameter variables from `err: any` to `err: unknown` and type guard against `Error` classes.

### 2.3 Admin Queue & Controller Typing

In [admin.controller.ts](file:///home/agprastyo/Developments/KirimKarya/apps/api/src/modules/admin/admin.controller.ts), import native BullMQ types:

```typescript
import { Queue, Job } from "bullmq";
```

Update helper functions:
```typescript
const getQueueStats = async (queue: Queue, name: string) => { ... }
const getFailedJobs = async (queue: Queue, name: string) => { ... }
```

### 2.4 Drizzle ORM Select Inferences

In [galleries.controller.ts](file:///home/agprastyo/Developments/KirimKarya/apps/api/src/modules/galleries/galleries.controller.ts), replace `let newPhoto: any = null;` with Drizzle's inferred schema types:

```typescript
import { type photos } from "@kirimkarya/db";
let newPhoto: typeof photos.$inferSelect | null = null;
```

Similarly, type updates in [public.service.ts](file:///home/agprastyo/Developments/KirimKarya/apps/api/src/modules/public/public.service.ts) using `Partial<typeof feedbacks.$inferInsert>`.

---

## 3. Test Coverage Strategy

### 3.1 Unit Testing the Logger

We will create [logger.test.ts](file:///home/agprastyo/Developments/KirimKarya/apps/api/src/core/logger.test.ts) and cover:
- Standard string logs.
- Structured metadata logs.
- Formatting of `Error` instances.
- Formatting of primitive types (string, number, object) in catch blocks.

### 3.2 Integration Testing the Admin Controller

We will create `apps/api/tests/integration/admin.integration.test.ts`. Since the admin routes interact with BullMQ queues, we will mock the queues and jobs cleanly:
- `GET /api/admin/stats` mocks counts for active, waiting, delayed, failed, and completed jobs.
- `GET /api/admin/queues/:name/failed` mocks listing jobs and asserts properties.
- `POST /api/admin/queues/:name/retry-all` asserts that `.retry()` was called on the mock failed jobs.
