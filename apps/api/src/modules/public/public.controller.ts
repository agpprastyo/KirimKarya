import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { apiResponse, createApiResponseSchema, ApiErrorSchema } from "../../lib/response";
import {
    PublicGalleryResponseSchema,
    PublicPhotoResponseSchema,
    FeedbackRequestSchema,
    AccessRequestRequestSchema,
    VerifyOTPRequestSchema,
    VerifyPasswordRequestSchema,
} from "./public.schema";
import { publicService } from "./public.service";
import { notificationQueue } from "@kirimkarya/queue";
import { s3 } from "@kirimkarya/storage";
import type { HonoEnv } from "../../core/types/hono";
import { env } from "../../env";
import { setCookie, getCookie } from "hono/cookie";

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
        403: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Gallery access required"),
                },
            },
            description: "Access denied",
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

const verifyOTPRoute = createRoute({
    method: "post",
    path: "/galleries/{id}/verify-otp",
    summary: "Verify OTP and Grant Access",
    tags: ["Public"],
    request: {
        params: z.object({
            id: z.string().uuid(),
        }),
        body: {
            content: {
                "application/json": {
                    schema: VerifyOTPRequestSchema,
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
            description: "Access granted",
        },
        401: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Invalid or expired code"),
                },
            },
            description: "Code mismatch or expired",
        },
    },
});

const requestAccessRoute = createRoute({
    method: "post",
    path: "/galleries/{id}/request-access",
    summary: "Request OTP Access to Private Gallery",
    tags: ["Public"],
    request: {
        params: z.object({
            id: z.string().uuid(),
        }),
        body: {
            content: {
                "application/json": {
                    schema: AccessRequestRequestSchema,
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
            description: "OTP sent if authorized",
        },
        403: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Unauthorized email"),
                },
            },
            description: "Email not in allowed list",
        },
    },
});

const verifyPasswordRoute = createRoute({
    method: "post",
    path: "/galleries/{id}/verify-password",
    summary: "Verify Static Password and Grant Access",
    tags: ["Public"],
    request: {
        params: z.object({
            id: z.string().uuid(),
        }),
        body: {
            content: {
                "application/json": {
                    schema: VerifyPasswordRequestSchema,
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
            description: "Access granted",
        },
        401: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Invalid password"),
                },
            },
            description: "Password mismatch",
        },
        403: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Email not authorized"),
                },
            },
            description: "Email not in allowed list",
        },
    },
});

const downloadGalleryZIPRoute = createRoute({
    method: "get",
    path: "/galleries/{id}/download",
    summary: "Download High-Res Photo ZIP",
    tags: ["Public"],
    request: {
        params: z.object({
            id: z.string().uuid(),
        }),
    },
    responses: {
        200: {
            description: "Binary ZIP file",
            content: {
                "application/zip": {
                    schema: { type: "string", format: "binary" },
                },
            },
        },
        403: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Access denied or ZIP not ready"),
                },
            },
            description: "Forbidden",
        },
        404: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Gallery or ZIP not found"),
                },
            },
            description: "Not found",
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
        deliveredAt: gallery.deliveredAt?.toISOString() || null,
    }), 200);
});

publicRoutes.openapi(listPublicPhotosRoute, async (c) => {
    const { id: galleryId } = c.req.valid("param");
    const clientId = c.req.header("x-client-id") || "anonymous";

    const gallery = await publicService.getGalleryMetadata(galleryId);
    if (!gallery) return c.json(apiResponse.error("Gallery not found"), 404);

    if (gallery.status === "DRAFT") {
        const user = c.get("user");
        if (!user || user.id !== gallery.userId) {
            return c.json(apiResponse.error("Gallery not published yet"), 403);
        }
    }

    if (gallery.isPrivate) {
        const accessCookie = getCookie(c, `gallery_access_${galleryId}`);
        if (!accessCookie) {
            return c.json(apiResponse.error("Gallery access required"), 403);
        }
    }

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

publicRoutes.openapi(requestAccessRoute, async (c) => {
    const { id: galleryId } = c.req.valid("param");
    const { email } = c.req.valid("json");

    const result = await publicService.requestOTP(galleryId, email);
    if (!result.success) {
        return c.json(apiResponse.error(result.error || "Request failed"), 403);
    }

    return c.json(apiResponse.success({ success: true }), 200);
});

publicRoutes.openapi(verifyOTPRoute, async (c) => {
    const { id: galleryId } = c.req.valid("param");
    const { email, code } = c.req.valid("json");

    const result = await publicService.verifyOTP(galleryId, email, code);
    if (!result.success) {
        return c.json(apiResponse.error(result.error || "Verification failed"), 401);
    }

    setCookie(c, `gallery_access_${galleryId}`, email, {
        path: "/",
        maxAge: 60 * 60 * 24,
        httpOnly: true,
        sameSite: "Lax",
        secure: process.env.NODE_ENV === "production",
    });

    return c.json(apiResponse.success({ success: true }), 200);
});

publicRoutes.openapi(verifyPasswordRoute, async (c) => {
    const { id: galleryId } = c.req.valid("param");
    const { email, password } = c.req.valid("json");

    const result = await publicService.verifyStaticPassword(galleryId, email, password);
    if (!result.success) {
        if (result.error === "Email not authorized") {
            return c.json(apiResponse.error(result.error), 403);
        }
        return c.json(apiResponse.error(result.error || "Invalid password"), 401);
    }

    setCookie(c, `gallery_access_${galleryId}`, email, {
        path: "/",
        maxAge: 60 * 60 * 24,
        httpOnly: true,
        sameSite: "Lax",
        secure: process.env.NODE_ENV === "production",
    });

    return c.json(apiResponse.success({ success: true }), 200);
});

publicRoutes.openapi(downloadGalleryZIPRoute, async (c) => {
    const { id: galleryId } = c.req.valid("param");

    const gallery = await publicService.getGalleryMetadata(galleryId);
    if (!gallery) return c.json(apiResponse.error("Gallery not found"), 404);

    if (gallery.isPrivate) {
        const accessCookie = getCookie(c, `gallery_access_${galleryId}`);
        if (!accessCookie) {
            return c.json(apiResponse.error("Gallery access required"), 403);
        }
    }

    if (gallery.deliveryStatus !== "COMPLETED" || !gallery.deliveryZipKey) {
        return c.json(apiResponse.error("High-res package is not ready yet"), 403);
    }
    try {
        const fileRef = s3.file(gallery.deliveryZipKey);
        if (!(await fileRef.exists())) {
            return c.json(apiResponse.error("ZIP file not found in storage"), 404);
        }

        const buffer = await fileRef.arrayBuffer();

        return c.body(buffer, 200, {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="${gallery.title.replace(/[^a-z0-9]/gi, '_')}.zip"`,
        });
    } catch (error) {
        console.error("Failed to serve high-res ZIP:", error);
        return c.json(apiResponse.error("Failed to download ZIP"), 500);
    }
});

export default publicRoutes;
