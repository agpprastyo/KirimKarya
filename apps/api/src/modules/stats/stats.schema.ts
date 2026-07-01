import { z } from "@hono/zod-openapi";

export const StatsSummaryResponseSchema = z.object({
    stats: z.object({
        totalGalleries: z.number().openapi({ example: 5 }),
        totalPhotos: z.number().openapi({ example: 120 }),
        totalViews: z.number().openapi({ example: 450 }),
        totalSelections: z.number().openapi({ example: 45 }),
    }),
    topGalleries: z.array(
        z.object({
            id: z.string().uuid().openapi({ example: "018e2a3b-4c5d-7e8f-9a0b-1c2d3e4f5a6b" }),
            title: z.string().openapi({ example: "Wedding of John & Doe" }),
            views: z.number().openapi({ example: 150 }),
        })
    ),
    recentActivity: z.array(
        z.object({
            id: z.string().uuid(),
            galleryTitle: z.string().openapi({ example: "Wedding of John & Doe" }),
            galleryId: z.string().uuid(),
            photoId: z.string().uuid(),
            type: z.string().openapi({ example: "SELECTION" }),
            createdAt: z.coerce.string().openapi({ example: "2024-01-01T00:00:00Z" }),
            clientIdentifier: z.string().nullable().openapi({ example: "client@example.com" }),
        })
    ),
}).openapi("StatsSummaryResponse");

export const StatsInsightsResponseSchema = z.object({
    funnel: z.object({
        totalViews: z.number().openapi({ example: 450 }),
        totalPhotos: z.number().openapi({ example: 120 }),
        totalSelections: z.number().openapi({ example: 45 }),
        totalDelivered: z.number().openapi({ example: 2 }),
        totalGalleries: z.number().openapi({ example: 5 }),
    }),
    dailyActivity: z.array(
        z.object({
            date: z.string().openapi({ example: "2024-01-01" }),
            count: z.number().openapi({ example: 10 }),
            selections: z.number().openapi({ example: 4 }),
        })
    ),
    topClients: z.array(
        z.object({
            clientIdentifier: z.string().nullable().openapi({ example: "client@example.com" }),
            totalSelections: z.number().openapi({ example: 15 }),
            totalComments: z.number().openapi({ example: 3 }),
            totalActivity: z.number().openapi({ example: 18 }),
            galleryTitle: z.string().openapi({ example: "Wedding of John & Doe" }),
            galleryId: z.string().uuid(),
            clientEmail: z.string().nullable().openapi({ example: "client@example.com" }),
            lastActivity: z.string().nullable().openapi({ example: "2024-01-01T00:00:00Z" }),
        })
    ),
    galleryFunnels: z.array(
        z.object({
            id: z.string().uuid(),
            title: z.string().openapi({ example: "Wedding of John & Doe" }),
            views: z.number().openapi({ example: 150 }),
            totalPhotos: z.number().openapi({ example: 50 }),
            selections: z.number().openapi({ example: 20 }),
            delivered: z.number().openapi({ example: 1 }),
        })
    ),
}).openapi("StatsInsightsResponse");

export const StatsClientsResponseSchema = z.array(
    z.object({
        clientIdentifier: z.string().nullable().openapi({ example: "client@example.com" }),
        galleryId: z.string().uuid(),
        galleryTitle: z.string().openapi({ example: "Wedding of John & Doe" }),
        clientEmail: z.string().nullable().openapi({ example: "client@example.com" }),
        deliveryStatus: z.enum(["IDLE", "QUEUED", "PROCESSING", "COMPLETED", "FAILED"]).nullable().optional(),
        totalSelections: z.number().openapi({ example: 15 }),
        totalComments: z.number().openapi({ example: 3 }),
        lastActivity: z.string().nullable().openapi({ example: "2024-01-01T00:00:00Z" }),
    })
).openapi("StatsClientsResponse");
