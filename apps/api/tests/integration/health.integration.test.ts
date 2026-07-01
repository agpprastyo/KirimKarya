import { mock, describe, test, expect } from "bun:test";

// Mock database
mock.module("@kirimkarya/db", () => ({
    db: {
        execute: async () => [{ '?column?': 1 }],
    },
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
    s3: {
        file: () => ({
            exists: async () => true,
        }),
    },
    withS3Breaker: async (action: any) => await action(),
}));

// Mock mail & queue since they get loaded by other controllers imported in index.ts
mock.module("@kirimkarya/mail", () => ({}));
mock.module("@kirimkarya/queue", () => ({
    photoQueue: {},
    notificationQueue: {},
    cleanupQueue: {},
    deliveryQueue: {},
}));

import { app } from "../../src/index";

describe("Health API Integration Tests", () => {
    test("GET /api/health should return structured health indicators", async () => {
        const response = await app.request("/api/health");
        expect(response.status).toBe(200);

        const body = await response.json();
        expect(body.message).toContain("running");
        expect(body.data.services.db).toBe("READY");
        expect(body.data.services.redis).toBe("READY");
        expect(body.data.services.s3).toBe("READY");
    });
});
