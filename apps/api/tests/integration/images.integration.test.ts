import { mock, describe, test, expect, beforeEach } from "bun:test";

let mockGalleryResult: { isPrivate: boolean; status: string } | null = null;
let mockRedisTokens: Record<string, string> = {};

// Mock database
mock.module("@kirimkarya/db", () => ({
    db: {
        select: (fields?: any) => {
            const chain = {
                from: () => chain,
                where: () => {
                    return mockGalleryResult ? [mockGalleryResult] : [];
                }
            };
            return chain;
        }
    },
    galleries: {
        id: "id",
        isPrivate: "isPrivate",
        status: "status",
    }
}));

// Mock redis
mock.module("@kirimkarya/redis", () => ({
    redis: {
        get: async (key: string) => {
            return mockRedisTokens[key] || null;
        },
        ping: async () => "PONG",
        close: async () => {},
        incr: async () => 1,
        expire: async () => 1,
        ttl: async () => 60,
        set: async () => "OK",
        del: async () => 1,
    },
}));

// Mock better-auth
mock.module("../../src/modules/auth/auth.config", () => ({
    auth: {
        api: {
            getSession: async ({ headers }: any) => {
                const authHeader = headers?.Authorization || headers?.get?.("Authorization");
                if (authHeader === "Bearer user-owner") {
                    return { user: { id: "user-owner", email: "owner@example.com" } };
                }
                if (authHeader === "Bearer user-other") {
                    return { user: { id: "user-other", email: "other@example.com" } };
                }
                return null;
            }
        }
    }
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

// Mock imagesService
mock.module("../../src/modules/images/images.service", () => ({
    imagesService: {
        getImageStream: async (key: string) => {
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(new TextEncoder().encode("fake-image-data"));
                    controller.close();
                }
            });
            return {
                stream,
                contentType: "image/jpeg",
            };
        }
    }
}));

import { app } from "../../src/index";

describe("Images Route Security Integration Tests", () => {
    beforeEach(() => {
        mockGalleryResult = null;
        mockRedisTokens = {};
    });

    test("GET public path (uploads/*) should bypass all auth checks", async () => {
        const response = await app.request("/api/images/uploads/test.jpg");
        expect(response.status).toBe(200);
        const text = await response.text();
        expect(text).toBe("fake-image-data");
    });

    test("GET private path by owner should be allowed", async () => {
        const response = await app.request(
            "/api/images/user-owner/gallery-123/thumbs/photo.jpg",
            {
                headers: {
                    Authorization: "Bearer user-owner",
                },
            }
        );
        expect(response.status).toBe(200);
        const text = await response.text();
        expect(text).toBe("fake-image-data");
    });

    test("GET private path by non-owner logged-in user without guest access should be forbidden (403)", async () => {
        mockGalleryResult = { isPrivate: false, status: "DRAFT" };
        const response = await app.request(
            "/api/images/user-owner/gallery-123/thumbs/photo.jpg",
            {
                headers: {
                    Authorization: "Bearer user-other",
                },
            }
        );
        expect(response.status).toBe(403);
        const body = (await response.json()) as any;
        expect(body.error).toBe("Forbidden");
    });

    test("GET private path by guest (anonymous, published public gallery) should be allowed", async () => {
        mockGalleryResult = { isPrivate: false, status: "PUBLISHED" };
        const response = await app.request("/api/images/user-owner/gallery-123/thumbs/photo.jpg");
        expect(response.status).toBe(200);
        const text = await response.text();
        expect(text).toBe("fake-image-data");
    });

    test("GET private path by guest (anonymous, draft public gallery) should be unauthorized (401)", async () => {
        mockGalleryResult = { isPrivate: false, status: "DRAFT" };
        const response = await app.request("/api/images/user-owner/gallery-123/thumbs/photo.jpg");
        expect(response.status).toBe(401);
        const body = (await response.json()) as any;
        expect(body.error).toBe("Unauthorized");
    });

    test("GET private path by guest (anonymous, published private gallery, no token) should be unauthorized (401)", async () => {
        mockGalleryResult = { isPrivate: true, status: "PUBLISHED" };
        const response = await app.request("/api/images/user-owner/gallery-123/thumbs/photo.jpg");
        expect(response.status).toBe(401);
    });

    test("GET private path by guest (anonymous, published private gallery, valid token) should be allowed", async () => {
        mockGalleryResult = { isPrivate: true, status: "PUBLISHED" };
        mockRedisTokens["access_token:gallery-123:valid-token"] = "guest@example.com";
        const response = await app.request(
            "/api/images/user-owner/gallery-123/thumbs/photo.jpg",
            {
                headers: {
                    Cookie: "gallery_access_gallery-123=valid-token",
                },
            }
        );
        expect(response.status).toBe(200);
        const text = await response.text();
        expect(text).toBe("fake-image-data");
    });

    test("GET private path by guest (anonymous, draft private gallery, valid token) should be unauthorized (401)", async () => {
        mockGalleryResult = { isPrivate: true, status: "DRAFT" };
        mockRedisTokens["access_token:gallery-123:valid-token"] = "guest@example.com";
        const response = await app.request(
            "/api/images/user-owner/gallery-123/thumbs/photo.jpg",
            {
                headers: {
                    Cookie: "gallery_access_gallery-123=valid-token",
                },
            }
        );
        expect(response.status).toBe(401);
    });

    test("GET original file by guest (anonymous, published public gallery) should be unauthorized (401)", async () => {
        mockGalleryResult = { isPrivate: false, status: "PUBLISHED" };
        const response = await app.request("/api/images/user-owner/gallery-123/original/photo.jpg");
        expect(response.status).toBe(401);
    });
});
