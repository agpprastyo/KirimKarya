# KirimKarya TypeScript Hardening & Test Coverage Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate unconstrained `any` types from logger, response, admin queues, and database variables, replacing them with type-safe Zod and TypeScript structures, backed by comprehensive unit and integration tests.

**Architecture:** We declare concrete interface shapes for log contexts, import native types from BullMQ, and query ORM metadata directly from Drizzle schemas instead of type assertions. New test files verify these changes cleanly.

**Tech Stack:** Bun Runtime, Hono.js, BullMQ, TypeScript, Drizzle ORM.

## Global Constraints

- Tech Stack: Bun v1.3+, TypeScript, BullMQ, Drizzle ORM.
- Zero `any` policy: Do not write new `any` declarations in production code. Use `unknown` or custom interfaces instead.
- Follow DRY and YAGNI.
- Ensure all tests run successfully on every step.

---

### Task 1: Core Logger Type Hardening

**Files:**
- Modify: `apps/api/src/core/logger.ts`
- Create: `apps/api/src/core/logger.test.ts`

**Interfaces:**
- Consumes: Standard `process.env.NODE_ENV`
- Produces: `LogContext` interface and updated `logger` formatters.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/core/logger.test.ts` with test cases to check log context and error formatting:

```typescript
import { expect, test, describe } from "bun:test";
import { logger } from "./logger";

describe("Core Logger", () => {
    test("formatError should format Error instances properly", () => {
        // Assert formatError handles standard Error instances
        const err = new Error("Test error message");
        const formatted = (logger as any).formatError(err);
        expect(formatted.message).toBe("Test error message");
        expect(formatted.name).toBe("Error");
    });

    test("formatError should format primitive values as strings", () => {
        const formattedStr = (logger as any).formatError("Raw string error");
        expect(formattedStr.message).toBe("Raw string error");

        const formattedNum = (logger as any).formatError(500);
        expect(formattedNum.message).toBe("500");
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/core/logger.test.ts`
Expected: Failure if `formatError` is not accessible or works incorrectly.

- [ ] **Step 3: Write minimal implementation**

Update `apps/api/src/core/logger.ts`:
- Define `LogContext` interface.
- Replace `any` in `formatError(error: any): any` and `formatted: any`.

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

// Inside Logger class:
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

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/core/logger.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/core/logger.ts apps/api/src/core/logger.test.ts
git commit -m "refactor(logger): type-safe error and context formatting"
```

---

### Task 2: Response Utility & Caught Error Typing

**Files:**
- Modify: `apps/api/src/lib/response.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/src/core/middlewares/error-handler.ts`

**Interfaces:**
- Consumes: `apiResponse` from `../../lib/response`

- [ ] **Step 1: Write the failing test**

We verify that compiling `index.ts` and `error-handler.ts` does not contain implicit `any` violations when typing catch blocks. We can test this by running type checks:
Run: `bun x tsc --noEmit`

- [ ] **Step 2: Run test to verify it fails**

(Should fail if there are typescript errors, otherwise type checking is green).

- [ ] **Step 3: Write minimal implementation**

1. Modify `apps/api/src/lib/response.ts`:
   - Replace `errorDetails: any` with `errorDetails: unknown` in `ApiErrorSchema`.
   - Update `ApiResponse` template:
     ```typescript
     export interface ApiResponse<T = unknown> {
         success: boolean;
         message: string;
         data?: T;
         meta?: Record<string, unknown>;
         error?: unknown;
     }
     ```

2. Modify `apps/api/src/core/middlewares/error-handler.ts`:
   - Change `(e: any)` in `formattedErrors` to `(e: z.ZodIssue)`.

3. Modify `apps/api/src/index.ts`:
   - Replace `catch (err: any)` with `catch (err: unknown)` in shutdown handlers.
   - Use `err instanceof Error ? err.message : String(err)` when logging.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun x tsc --noEmit` and `bun test`
Expected: All type checking and test runs are green.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/response.ts apps/api/src/index.ts apps/api/src/core/middlewares/error-handler.ts
git commit -m "refactor(api): type caught errors in main entrypoint and handlers"
```

---

### Task 3: Admin Controller Queue/Job Type Hardening

**Files:**
- Modify: `apps/api/src/modules/admin/admin.controller.ts`
- Create: `apps/api/tests/integration/admin.integration.test.ts`

**Interfaces:**
- Consumes: `photoQueue`, `notificationQueue`, `cleanupQueue`, `deliveryQueue` from `@kirimkarya/queue`

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/integration/admin.integration.test.ts` to test admin statistics and failed job listings:

```typescript
import { mock, describe, test, expect } from "bun:test";

// Mock database
mock.module("@kirimkarya/db", () => ({
    db: {
        select: () => ({
            from: () => ({
                innerJoin: () => [{ count: 10 }]
            })
        }),
    },
    user: {},
    galleries: {},
}));

// Mock BullMQ queues
const mockQueueStats = {
    getActiveCount: async () => 1,
    getWaitingCount: async () => 2,
    getDelayedCount: async () => 0,
    getFailedCount: async () => 5,
    getCompletedCount: async () => 20,
    getFailed: async () => [
        { id: "job-1", name: "test-job", data: {}, failedReason: "error", stacktrace: [], timestamp: Date.now() }
    ],
};

mock.module("@kirimkarya/queue", () => ({
    photoQueue: mockQueueStats,
    notificationQueue: mockQueueStats,
    cleanupQueue: mockQueueStats,
    deliveryQueue: mockQueueStats,
}));

import { app } from "../../src/index";

describe("Admin Endpoints", () => {
    test("GET /api/admin/stats should return queue metrics", async () => {
        const response = await app.request("/api/admin/stats");
        expect(response.status).toBe(200);

        const body = await response.json();
        expect(body.data.queues).toBeArray();
        expect(body.data.queues[0].active).toBe(1);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/integration/admin.integration.test.ts`
Expected: Fails or throws compilation/mocking errors.

- [ ] **Step 3: Write minimal implementation**

Update `apps/api/src/modules/admin/admin.controller.ts`:
- Import `Queue` and `Job` from `bullmq`.
- Replace `any` types:

```typescript
import { Queue, Job } from "bullmq";

const getQueueStats = async (queue: Queue, name: string) => {
    const [active, waiting, delayed, failed, completed] = await Promise.all([
        queue.getActiveCount(),
        queue.getWaitingCount(),
        queue.getDelayedCount(),
        queue.getFailedCount(),
        queue.getCompletedCount(),
    ]);
    return {
        name,
        active,
        waiting,
        delayed,
        failed,
        completed,
    };
};

const getFailedJobs = async (queue: Queue, name: string) => {
    const jobs = await queue.getFailed(0, 50);
    return jobs.map((job: Job) => ({
        id: job.id || "",
        name: job.name,
        queueName: name,
        data: job.data,
        failedReason: job.failedReason || null,
        stacktrace: job.stacktrace || null,
        timestamp: job.timestamp,
    }));
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/integration/admin.integration.test.ts`
Expected: Pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/admin/admin.controller.ts apps/api/tests/integration/admin.integration.test.ts
git commit -m "refactor(admin): strong typing for BullMQ queues and jobs in admin routes"
```

---

### Task 4: Drizzle ORM Type Inference

**Files:**
- Modify: `apps/api/src/modules/galleries/galleries.controller.ts`
- Modify: `apps/api/src/modules/public/public.service.ts`

**Interfaces:**
- Consumes: `photos`, `feedbacks` schema models from `@kirimkarya/db`

- [ ] **Step 1: Write the failing test**

Verify compilation passes without `any` violations:
Run: `bun x tsc --noEmit`

- [ ] **Step 2: Run test to verify it fails**

(Fails if there are TypeScript type mismatches).

- [ ] **Step 3: Write minimal implementation**

1. In `apps/api/src/modules/galleries/galleries.controller.ts`:
   - Replace:
     ```typescript
     let newPhoto: any = null;
     ```
     with:
     ```typescript
     import { type photos } from "@kirimkarya/db";
     let newPhoto: typeof photos.$inferSelect | null = null;
     ```

2. In `apps/api/src/modules/public/public.service.ts`:
   - Replace:
     ```typescript
     const updateData: any = { updatedAt: new Date() };
     ```
     with:
     ```typescript
     import { type feedbacks } from "@kirimkarya/db";
     const updateData: Partial<typeof feedbacks.$inferInsert> = { updatedAt: new Date() };
     ```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun x tsc --noEmit` and `bun test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/galleries/galleries.controller.ts apps/api/src/modules/public/public.service.ts
git commit -m "refactor(db): use Drizzle schema inferred types instead of any assertions"
```
