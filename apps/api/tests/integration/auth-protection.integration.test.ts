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
    s3: {},
}));

// Mock mail & queue
mock.module("@kirimkarya/mail", () => ({}));
mock.module("@kirimkarya/queue", () => ({
    photoQueue: {},
    notificationQueue: {},
    cleanupQueue: {},
    deliveryQueue: {},
}));

import { app } from "../../src/index";

describe("Auth Protection API Integration Tests", () => {
    test("GET /api/galleries should block request with 401 when unauthenticated", async () => {
        const response = await app.request("/api/galleries");
        expect(response.status).toBe(401);

        const body = (await response.json()) as any;
        expect(body.message).toBe("Unauthorized");
    });

    test("GET /api/stats should block request with 401 when unauthenticated", async () => {
        const response = await app.request("/api/stats");
        expect(response.status).toBe(401);
    });
});
