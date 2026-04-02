import { z } from "@hono/zod-openapi";

export const PublicGalleryResponseSchema = z.object({
    id: z.string().uuid(),
    title: z.string(),
    clientEmail: z.string().nullable(),
    status: z.string(),
    deliveryStatus: z.string().default("IDLE"),
    isPrivate: z.boolean(),
    accessMode: z.enum(["OTP", "PASSWORD"]),
    createdAt: z.string(),
    deliveredAt: z.string().nullable().optional(),
});

export const AccessRequestRequestSchema = z.object({
    email: z.string().email(),
});

export const VerifyOTPRequestSchema = z.object({
    email: z.string().email(),
    code: z.string().length(6),
});

export const VerifyPasswordRequestSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

export const PublicPhotoResponseSchema = z.object({
    id: z.string().uuid(),
    thumbnailUrl: z.string().nullable(),
    watermarkUrl: z.string().nullable(),
    isSelected: z.boolean(),
    comment: z.string().nullable().optional(),
});

export const FeedbackRequestSchema = z.object({
    isSelected: z.boolean().optional(),
    comment: z.string().optional(),
});

export const DownloadZIPResponseSchema = z.object({
    url: z.string(),
});
