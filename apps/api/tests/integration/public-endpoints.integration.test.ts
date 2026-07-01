import { mock, describe, test, expect } from "bun:test";

const mockGalleryId = crypto.randomUUID();
let mockIsPrivate = false;

const mockPublicGallery = {
    id: mockGalleryId,
    title: "Client Proofing Gallery",
    clientEmail: "guest@example.com",
    status: "PUBLISHED",
    deliveryStatus: "IDLE",
    get isPrivate() { return mockIsPrivate; },
    userId: "user-abc",
    accessMode: "OTP",
    selectionLimit: 10,
    pricePerExtraPhoto: 5000,
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    deliveredAt: null,
    deliveryZipKey: null,
};

// Mock database
mock.module("@kirimkarya/db", () => {
    return {
        db: {
            execute: async () => [{ '?column?': 1 }],
            select: (fields?: any) => {
                const chain = {
                    from: () => chain,
                    where: () => {
                        let result: any = [mockPublicGallery];
                        if (fields) {
                            const keys = Object.keys(fields);
                            if (keys.length === 1 && keys[0] === 'galleryId') {
                                result = [{ galleryId: mockGalleryId }];
                            } else if (keys.length === 1 && keys[0] === 'id') {
                                result = [{ id: "feedback-123" }];
                            } else if (keys.includes('count')) {
                                result = [{ count: 0 }];
                            } else if (keys.includes('photoId')) {
                                result = [];
                            } else {
                                result = [mockPublicGallery];
                            }
                        }
                        const base: any = result;
                        base.orderBy = () => [{ id: "photo-1", thumbnailS3Key: "t1.jpg", watermarkS3Key: "w1.jpg" }];
                        base.limit = () => base;
                        return base;
                    },
                    innerJoin: () => chain,
                };
                return chain;
            },
            update: () => ({
                set: () => ({
                    where: () => ({
                        returning: () => [{ id: "feedback-123" }]
                    })
                })
            }),
            insert: () => ({
                values: () => ({
                    returning: () => [{ id: "feedback-123" }]
                })
            }),
        },
        galleries: {
            id: "id",
            selectionLimit: "selectionLimit",
            isPrivate: "isPrivate",
            passwordHash: "passwordHash",
            accessMode: "accessMode",
        },
        photos: {
            id: "id",
            galleryId: "galleryId",
            status: "status",
            uploadedAt: "uploadedAt",
        },
        feedbacks: {
            id: "id",
            photoId: "photoId",
            clientIdentifier: "clientIdentifier",
            isSelected: "isSelected",
            comment: "comment",
        },
        galleryAccess: {
            galleryId: "galleryId",
        }
    };
});

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

describe("Public Endpoints API Integration Tests", () => {
    const validUuid = crypto.randomUUID();

    test("GET /api/public/galleries/:id should return public metadata without auth", async () => {
        const response = await app.request(`/api/public/galleries/${validUuid}`);
        expect(response.status).toBe(200);

        const body = await response.json();
        expect(body.message).toBe("Success");
        expect(body.data.title).toBe("Client Proofing Gallery");
        expect(body.data.status).toBe("PUBLISHED");
    });

    test("GET /api/public/galleries/:id/photos should list gallery photos", async () => {
        const response = await app.request(`/api/public/galleries/${validUuid}/photos`);
        expect(response.status).toBe(200);

        const body = await response.json();
        expect(body.message).toBe("Success");
        expect(body.data).toBeArray();
        expect(body.data[0].id).toBe("photo-1");
    });

    test("POST /api/public/photos/:id/feedback should fail with 403 when dummy token is provided", async () => {
        // Enable mockIsPrivate for this test
        mockIsPrivate = true;
        try {
            const photoId = crypto.randomUUID();
            // We target a mock private photo ID and pass a fake token cookie
            const response = await app.request(
                `/api/public/photos/${photoId}/feedback`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-client-id": "client-uuid-here",
                        "Cookie": `gallery_access_${mockGalleryId}=fake_token`,
                    },
                    body: JSON.stringify({ isSelected: true }),
                }
            );
            expect(response.status).toBe(403);
        } finally {
            mockIsPrivate = false;
        }
    });

    test("GET /api/images/:userId/:galleryId/thumbs/:filename should fail with 401 when private and dummy token cookie is provided", async () => {
        mockIsPrivate = true;
        try {
            const response = await app.request(
                `/api/images/user-abc/${mockGalleryId}/thumbs/test.jpg`,
                {
                    method: "GET",
                    headers: {
                        "Cookie": `gallery_access_${mockGalleryId}=fake_token`,
                    }
                }
            );
            expect(response.status).toBe(401);
        } finally {
            mockIsPrivate = false;
        }
    });
});
