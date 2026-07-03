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

// Mock redis
mock.module("@kirimkarya/redis", () => ({
    redis: {
        ping: async () => "PONG",
        close: async () => {},
        incr: async () => 1,
        expire: async () => 1,
        ttl: async () => 60,
        get: async () => null,
        set: async () => "OK",
        del: async () => 1,
    },
}));

// Mock storage
mock.module("@kirimkarya/storage", () => ({
    s3: {},
}));

// Mock mail
mock.module("@kirimkarya/mail", () => ({}));

// Mock better-auth
mock.module("../../src/modules/auth/auth.config", () => ({
    auth: {
        api: {
            getSession: async ({ headers }: { headers: unknown }) => {
                const authHeader = headers instanceof Headers
                    ? headers.get("Authorization")
                    : (headers as Record<string, string | undefined> | undefined)?.Authorization;
                if (authHeader === "Bearer admin-token") {
                    return { user: { id: "admin-user", email: "admin@example.com", role: "admin" } };
                }
                return null;
            }
        }
    }
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
    test("GET /api/admin/jobs/status should return queue metrics", async () => {
        const response = await app.request("/api/admin/jobs/status", {
            headers: {
                Authorization: "Bearer admin-token",
            },
        });
        expect(response.status).toBe(200);

        const body = (await response.json()) as any;
        expect(body.data.queues).toBeArray();
        expect(body.data.queues[0].active).toBe(1);
    });
});
