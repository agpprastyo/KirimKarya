import { mock, describe, test, expect } from "bun:test";
import { redis } from "@kirimkarya/redis";

let redisStore: Record<string, string> = {};

mock.module("@kirimkarya/redis", () => ({
    redis: {
        get: async (key: string) => redisStore[key] || null,
        set: async (key: string, value: string) => {
            redisStore[key] = value;
            return "OK";
        },
        expire: async (key: string, seconds: number) => 1,
        del: async (key: string) => {
            delete redisStore[key];
            return 1;
        },
        incr: async (key: string) => 1,
    },
}));

mock.module("@kirimkarya/db", () => {
    const mockMetadata = {
        id: "gallery-123",
        title: "Public E2E",
        clientEmail: "guest@example.com",
        status: "PUBLISHED",
        deliveryStatus: "IDLE",
        isPrivate: false,
        userId: "user-abc",
        accessMode: "OTP",
        selectionLimit: 5,
        pricePerExtraPhoto: 10000,
        createdAt: new Date("2026-06-01T00:00:00.000Z"),
        deliveredAt: null,
        deliveryZipKey: null,
    };
    return {
        db: {
            select: () => ({
                from: () => ({
                    where: () => {
                        const base: any = [mockMetadata];
                        base.orderBy = () => [{ id: "photo-1", thumbnailS3Key: "thumb", watermarkS3Key: "wm" }];
                        return base;
                    },
                    innerJoin: () => ({
                        where: () => []
                    })
                })
            }),
            execute: async () => {},
        },
        galleries: {
            id: "id",
        },
        photos: {
            id: "id",
            galleryId: "galleryId",
            status: "status",
            uploadedAt: "uploadedAt",
        },
        feedbacks: {
            photoId: "photoId",
        },
        galleryAccess: {
            galleryId: "galleryId",
        }
    };
});

mock.module("@kirimkarya/mail", () => ({
    sendOTPEmail: async (email: string, otp: string, title: string) => {},
}));

import { publicService } from "./public.service";

describe("PublicService Unit Tests", () => {
    test("getGalleryMetadata should populate Redis cache and serve cached metadata afterwards", async () => {
        redisStore = {}; // Reset redis

        // First call - cache miss (fetches from database mock and stores in Redis)
        const gallery = await publicService.getGalleryMetadata("gallery-123");
        expect(gallery).not.toBeNull();
        expect(gallery?.title).toBe("Public E2E");

        // Cache key should be set
        expect(redisStore["cache:gallery:gallery-123:metadata"]).not.toBeUndefined();

        // Alter title in the Redis store directly to check if it gets pulled from Redis next
        redisStore["cache:gallery:gallery-123:metadata"] = JSON.stringify({
            title: "Cached Title",
            createdAt: new Date("2026-06-01T00:00:00.000Z").toISOString(),
        });

        // Second call - cache hit
        const cachedGallery = await publicService.getGalleryMetadata("gallery-123");
        expect(cachedGallery).not.toBeNull();
        expect(cachedGallery?.title).toBe("Cached Title");
    });

    test("getGalleryPhotos should cache results in Redis", async () => {
        redisStore = {};

        const photosList = await publicService.getGalleryPhotos("gallery-123");
        expect(photosList).toBeArray();

        // Photos cache key should exist in Redis
        expect(redisStore["cache:gallery:gallery-123:photos"]).not.toBeUndefined();
    });
});

describe("PublicService Token Resolution", () => {
    test("resolveClientEmail should return email for valid token and null for invalid token", async () => {
        const galleryId = "3657143f-e860-4321-9172-0e70d49df0ab";
        const token = "valid_test_token_123456";
        const email = "client@example.com";

        // Store mapping in Redis
        await redis.set(`access_token:${galleryId}:${token}`, email);
        await redis.expire(`access_token:${galleryId}:${token}`, 60);

        const resolved = await publicService.resolveClientEmail(galleryId, token);
        expect(resolved).toBe(email);

        const resolvedInvalid = await publicService.resolveClientEmail(galleryId, "nonexistent");
        expect(resolvedInvalid).toBeNull();

        // Clean up
        await redis.del(`access_token:${galleryId}:${token}`);
    });
});
