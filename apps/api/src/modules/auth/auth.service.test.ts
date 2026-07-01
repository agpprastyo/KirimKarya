import { mock, describe, test, expect } from "bun:test";
import { Readable } from "stream";

// Mock external dependencies before importing AuthService
mock.module("@kirimkarya/storage", () => ({
    s3: {
        file: (key: string) => ({
            write: async (stream: any, options: any) => {
                // simulate writing stream
                return { key };
            },
            delete: async () => {},
        }),
    },
}));

mock.module("@kirimkarya/db", () => {
    return {
        db: {
            select: () => ({
                from: () => ({
                    where: () => ({
                        limit: () => [{ image: "/api/images/avatar/old-id.webp" }]
                    })
                })
            }),
            update: () => ({
                set: () => ({
                    where: async () => [{ id: "user-123" }]
                })
            })
        },
        user: {
            id: "id",
            image: "image",
        }
    };
});

import { authService } from "./auth.service";

describe("AuthService Unit Tests", () => {
    test("uploadAvatarStream should successfully process and upload avatar via stream", async () => {
        // Create a dummy readable stream representing an uploaded file
        const dummyStream = new Readable({
            read() {
                this.push(Buffer.from("dummy-image-content-goes-here-which-represents-an-upload"));
                this.push(null);
            }
        });

        const userId = "user-123";
        const mimeType = "image/png";

        const publicUrl = await authService.uploadAvatarStream(dummyStream, userId, mimeType);

        expect(publicUrl).toContain(`/api/images/avatar/${userId}/`);
        expect(publicUrl).toContain(".webp");
    });
});
