import { z } from "@hono/zod-openapi";

export const CreateGallerySchema = z.object({
    title: z.string().min(1).max(255).openapi({ example: "Wedding of John & Doe" }),
    clientEmail: z.email().optional().openapi({ example: "client@example.com" }),
    password: z.string().min(4).optional().openapi({ example: "123456" }),
    expiresAt: z.iso.datetime().optional().openapi({ example: "2024-12-31T23:59:59Z" }),
});

export const UpdateGallerySchema = CreateGallerySchema.partial().extend({
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional().openapi({ example: "PUBLISHED" }),
});

export const GalleryResponseSchema = z.object({
    id: z.uuid().openapi({ example: "018e2a3b-4c5d-7e8f-9a0b-1c2d3e4f5a6b" }),
    title: z.string().openapi({ example: "Wedding of John & Doe" }),
    clientEmail: z.string().nullable().openapi({ example: "client@example.com" }),
    status: z.string().openapi({ example: "DRAFT" }),
    expiresAt: z.coerce.string().nullable().openapi({ example: "2024-12-31T23:59:59Z" }),
    createdAt: z.coerce.string().openapi({ example: "2024-01-01T00:00:00Z" }),
    updatedAt: z.coerce.string().openapi({ example: "2024-01-01T00:00:00Z" }),
});
