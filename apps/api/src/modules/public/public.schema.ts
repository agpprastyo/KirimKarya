import { z } from "@hono/zod-openapi";

export const PublicGalleryResponseSchema = z.object({
    id: z.uuid(),
    title: z.string(),
    clientEmail: z.string().nullable(),
    status: z.string(),
    createdAt: z.string(),
});

export const PublicPhotoResponseSchema = z.object({
    id: z.uuid(),
    thumbnailUrl: z.string().nullable(),
    watermarkUrl: z.string().nullable(),
    isSelected: z.boolean(),
    comment: z.string().nullable().optional(),
});

export const FeedbackRequestSchema = z.object({
    isSelected: z.boolean().optional(),
    comment: z.string().optional(),
});
