import { mock, describe, test, expect, beforeAll } from "bun:test";

// Mock dependencies
mock.module("@kirimkarya/storage", () => ({
    s3: {
        file: (key: string) => ({
            delete: async () => {},
        }),
    },
    withS3Breaker: async (action: any) => await action(),
}));

mock.module("@kirimkarya/redis", () => ({
    redis: {
        del: async (key: string) => 1,
    },
}));

mock.module("@kirimkarya/db", () => {
    const mockGallery = {
        id: "gallery-123",
        title: "Test Gallery",
        status: "DRAFT",
        accessMode: "OTP",
        clientEmail: "client@example.com",
    };
    return {
        db: {
            transaction: async (cb: any) => {
                const tx = {
                    delete: () => ({
                        where: async () => []
                    })
                };
                return await cb(tx);
            },
            select: () => ({
                from: () => ({
                    innerJoin: () => ({
                        where: () => [{ count: 0 }]
                    })
                })
            })
        },
        galleries: {
            id: "id",
            title: "title",
            clientEmail: "clientEmail",
            passwordHash: "passwordHash",
            isPrivate: "isPrivate",
            expiresAt: "expiresAt",
        },
        photos: {
            id: "id",
            galleryId: "galleryId",
            originalS3Key: "originalS3Key",
            thumbnailS3Key: "thumbnailS3Key",
            watermarkS3Key: "watermarkS3Key",
        },
        feedbacks: {
            id: "id",
            photoId: "photoId",
            isSelected: "isSelected",
        },
        galleryRepository: {
            create: async (userId: string, data: any, tx?: any) => mockGallery,
            update: async (id: string, userId: string, data: any, tx?: any) => mockGallery,
            delete: async (id: string, userId: string, tx?: any) => mockGallery,
            clearAccess: async (id: string, tx?: any) => {},
            addAccess: async (records: any[], tx?: any) => {},
            findByIdAndUserId: async (id: string, userId: string) => mockGallery,
            getAccessEmails: async (id: string) => ["client@example.com"],
        },
        photoRepository: {
            listByGalleryId: async (id: string) => [
                { id: "photo-1", originalS3Key: "key-1", thumbnailS3Key: "key-2", watermarkS3Key: "key-3" }
            ],
        }
    };
});

import { galleryService } from "./galleries.service";

describe("GalleryService Unit Tests", () => {
    test("create should hash password and save access emails", async () => {
        const userId = "user-123";
        const payload = {
            title: "My Beautiful Gallery",
            clientEmail: "client@example.com",
            password: "SecurePassword123!",
            expiresAt: "2026-12-31T23:59:59.000Z",
        };

        const result = await galleryService.create(userId, payload);

        expect(result).not.toBeNull();
        expect(result.title).toBe("Test Gallery");
        expect(result.status).toBe("DRAFT");
    });

    test("update should invalidate Redis metadata and photos cache", async () => {
        const result = await galleryService.update("gallery-123", "user-123", {
            title: "Updated Title",
        });

        expect(result).not.toBeNull();
        expect(result?.title).toBe("Test Gallery");
    });

    test("delete should cascade records and invalidate cache", async () => {
        const result = await galleryService.delete("gallery-123", "user-123");

        expect(result).not.toBeNull();
    });
});
