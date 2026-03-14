import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { apiResponse, createApiResponseSchema, ApiErrorSchema } from "../../lib/response";
import {
    PublicGalleryResponseSchema,
    PublicPhotoResponseSchema,
    FeedbackRequestSchema
} from "./public.schema";
import { publicService } from "./public.service";
import { notificationQueue } from "@kirimkarya/queue";
import type { HonoEnv } from "../../core/types/hono";
import { env } from "../../env";

const publicRoutes = new OpenAPIHono<HonoEnv>();
const apiBaseUrl = env.PUBLIC_API_URL.replace(/\/$/, "");
const buildImageUrl = (key?: string) =>
    key ? `${apiBaseUrl}/api/images/${key}` : null;

const getPublicGalleryRoute = createRoute({
    method: "get",
    path: "/galleries/{id}",
    summary: "Get Public Gallery Metadata",
    tags: ["Public"],
    request: {
        params: z.object({
            id: z.uuid(),
        }),
    },
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: createApiResponseSchema(PublicGalleryResponseSchema),
                },
            },
            description: "Gallery metadata",
        },
        404: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Gallery not found"),
                },
            },
            description: "Not found",
        },
    },
});

const listPublicPhotosRoute = createRoute({
    method: "get",
    path: "/galleries/{id}/photos",
    summary: "List Public Photos",
    tags: ["Public"],
    request: {
        params: z.object({
            id: z.string().uuid(),
        }),
        headers: z.object({
            "x-client-id": z.string().optional(),
        }),
    },
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: createApiResponseSchema(z.array(PublicPhotoResponseSchema)),
                },
            },
            description: "List of processed photos",
        },
    },
});

const submitFeedbackRoute = createRoute({
    method: "post",
    path: "/photos/{id}/feedback",
    summary: "Submit Photo Feedback",
    tags: ["Public"],
    request: {
        params: z.object({
            id: z.string().uuid(),
        }),
        headers: z.object({
            "x-client-id": z.string(),
        }),
        body: {
            content: {
                "application/json": {
                    schema: FeedbackRequestSchema,
                },
            },
        },
    },
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: createApiResponseSchema(z.object({ success: z.boolean() })),
                },
            },
            description: "Feedback recorded",
        },
        400: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Client identifier required"),
                },
            },
            description: "Bad request",
        },
        404: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Photo not found"),
                },
            },
            description: "Photo or gallery not found",
        },
    },
});

const finalizeGallerySelectionRoute = createRoute({
    method: "post",
    path: "/galleries/{id}/finalize",
    summary: "Finalize Gallery Selection",
    tags: ["Public"],
    request: {
        params: z.object({
            id: z.string().uuid(),
        }),
        headers: z.object({
            "x-client-id": z.string(),
        }),
    },
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: createApiResponseSchema(z.object({ success: z.boolean() })),
                },
            },
            description: "Selection finalized",
        },
        404: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Gallery not found"),
                },
            },
            description: "Not found",
        },
        400: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Client identifier required"),
                },
            },
            description: "Bad request",
        },
    },
});

publicRoutes.openapi(getPublicGalleryRoute, async (c) => {
    const { id } = c.req.valid("param");
    const gallery = await publicService.getGalleryMetadata(id);
    if (!gallery) return c.json(apiResponse.error("Gallery not found"), 404);

    return c.json(apiResponse.success({
        ...gallery,
        createdAt: gallery.createdAt.toISOString(),
    }), 200);
});

publicRoutes.openapi(listPublicPhotosRoute, async (c) => {
    const { id: galleryId } = c.req.valid("param");
    const clientId = c.req.header("x-client-id") || "anonymous";

    const photos = await publicService.getGalleryPhotos(galleryId);
    const feedbacks = await publicService.getClientFeedbacks(galleryId, clientId);

    const feedbackMap = new Map(feedbacks.map(f => [f.photoId, { isSelected: f.isSelected, comment: f.comment }]));

    const results = photos.map(p => {
        const fb = feedbackMap.get(p.id);
        return {
            id: p.id,
            thumbnailUrl: buildImageUrl(p.thumbnailS3Key ?? undefined),
            watermarkUrl: buildImageUrl(p.watermarkS3Key ?? undefined),
            isSelected: fb?.isSelected || false,
            comment: fb?.comment || null,
        };
    });

    return c.json(apiResponse.success(results), 200);
});

publicRoutes.openapi(submitFeedbackRoute, async (c) => {
    const { id: photoId } = c.req.valid("param");
    const clientId = c.req.header("x-client-id");
    const { isSelected, comment } = c.req.valid("json");

    if (!clientId) return c.json(apiResponse.error("Client identifier required"), 400);

    const success = await publicService.toggleFeedback(photoId, clientId, isSelected, comment);

    if (!success) {
        return c.json(apiResponse.error("Photo not found or unauthorized"), 404);
    }

    return c.json(apiResponse.success({ success: true }), 200);
});

publicRoutes.openapi(finalizeGallerySelectionRoute, async (c) => {
    const { id: galleryId } = c.req.valid("param");
    const clientId = c.req.header("x-client-id");

    if (!clientId) return c.json(apiResponse.error("Client identifier required"), 400);

    const gallery = await publicService.getGalleryMetadata(galleryId);
    if (!gallery) return c.json(apiResponse.error("Gallery not found"), 404);

    const feedbacks = await publicService.getClientFeedbacks(galleryId, clientId);
    const selectionCount = feedbacks.filter(f => f.isSelected).length;

    await notificationQueue.add(`selection_submitted_${galleryId}_${clientId}`, {
        type: "CLIENT_SELECTION_SUBMITTED",
        galleryId,
        userId: gallery.userId,
        data: { selectionCount },
    });

    return c.json(apiResponse.success({ success: true }), 200);
});

export default publicRoutes;
