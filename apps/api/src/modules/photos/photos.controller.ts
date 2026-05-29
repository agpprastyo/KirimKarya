import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { apiResponse, createApiResponseSchema, ApiErrorSchema } from "../../lib/response";
import { galleryService } from "../galleries/galleries.service";
import { s3, withS3Breaker } from "@kirimkarya/storage";
import { db, photos, feedbacks, galleries, eq, and, inArray } from "@kirimkarya/db";
import { photoQueue } from "@kirimkarya/queue";
import sharp from "sharp";
import type { HonoEnv } from "../../core/types/hono";
import { env } from "../../env";

const photosRoutes = new OpenAPIHono<HonoEnv>();
const apiBaseUrl = env.PUBLIC_API_URL.replace(/\/$/, "");
const buildImageUrl = (key?: string) =>
    key ? `${apiBaseUrl}/api/images/${key}` : null;

const uploadPhotoRoute = createRoute({
    method: "post",
    path: "/galleries/{id}/photos",
    summary: "Upload Photo",
    tags: ["Photos"],
    request: {
        params: z.object({
            id: z.string().uuid(),
        }),
        body: {
            content: {
                "multipart/form-data": {
                    schema: z.object({
                        file: z.any().openapi({ type: "string", format: "binary" }),
                    }),
                },
            },
        },
    },
    responses: {
        202: {
            description: "Photo upload accepted and processing started",
            content: {
                "application/json": {
                    schema: createApiResponseSchema(z.object({
                        photoId: z.string().uuid(),
                    })),
                },
            },
        },
        404: {
            description: "Gallery not found",
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Gallery not found"),
                },
            },
        },
        400: {
            description: "Bad Request",
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Validation error"),
                },
            },
        },
        500: {
            description: "Internal Server Error",
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Failed to create photo record"),
                },
            },
        },
    },
});

const listGalleryPhotosRoute = createRoute({
    method: "get",
    path: "/galleries/{id}/photos",
    summary: "List Gallery Photos (Admin)",
    tags: ["Photos"],
    request: {
        params: z.object({
            id: z.string().uuid(),
        }),
    },
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: createApiResponseSchema(z.array(z.object({
                        id: z.string().uuid(),
                        filename: z.string(),
                        status: z.string(),
                        thumbnailUrl: z.string().nullable(),
                        previewUrl: z.string().nullable(),
                        selectionCount: z.number(),
                        feedbacks: z.array(z.object({
                            id: z.string().uuid(),
                            isSelected: z.boolean(),
                            comment: z.string().nullable(),
                            clientIdentifier: z.string().nullable(),
                            createdAt: z.string(),
                        })),
                    }))),
                },
            },
            description: "List of photos with selection info",
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

const deletePhotosRoute = createRoute({
    method: "delete",
    path: "/photos",
    summary: "Delete Photos (Bulk & Single)",
    tags: ["Photos"],
    request: {
        body: {
            content: {
                "application/json": {
                    schema: z.object({
                        ids: z.array(z.string().uuid()),
                    }),
                },
            },
        },
    },
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: createApiResponseSchema(z.object({
                        deletedCount: z.number(),
                    })),
                },
            },
            description: "Photos deleted successfully",
        },
        400: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Validation error"),
                },
            },
            description: "Bad Request",
        },
    },
});

const routes = photosRoutes
    .openapi(deletePhotosRoute, async (c) => {
        const user = c.get("user");
        const { ids } = c.req.valid("json");

        if (!ids || ids.length === 0) {
            return c.json(apiResponse.error("No photo IDs provided"), 400);
        }

        const list = await db
            .select({
                id: photos.id,
                galleryId: photos.galleryId,
                originalS3Key: photos.originalS3Key,
                thumbnailS3Key: photos.thumbnailS3Key,
                watermarkS3Key: photos.watermarkS3Key,
            })
            .from(photos)
            .innerJoin(galleries, eq(photos.galleryId, galleries.id))
            .where(
                and(
                    inArray(photos.id, ids),
                    eq(galleries.userId, user.id)
                )
            );

        if (list.length === 0) {
            return c.json(apiResponse.success({ deletedCount: 0 }), 200);
        }

        for (const p of list) {
            try {
                if (p.originalS3Key) {
                    await withS3Breaker(() => s3.file(p.originalS3Key).delete()).catch(() => {});
                }
                if (p.thumbnailS3Key) {
                    const key = p.thumbnailS3Key;
                    await withS3Breaker(() => s3.file(key).delete()).catch(() => {});
                }
                if (p.watermarkS3Key) {
                    const key = p.watermarkS3Key;
                    await withS3Breaker(() => s3.file(key).delete()).catch(() => {});
                }
            } catch (err) {
                console.error("Failed to delete S3 files for photo", p.id, err);
            }
        }

        const targetIds = list.map(p => p.id);
        
        await db.delete(feedbacks).where(inArray(feedbacks.photoId, targetIds));
        await db.delete(photos).where(inArray(photos.id, targetIds));

        return c.json(apiResponse.success({ deletedCount: targetIds.length }), 200);
    })
    .openapi(uploadPhotoRoute, async (c) => {
        const user = c.get("user");
        const { id: galleryId } = c.req.valid("param");

        const gallery = await galleryService.getById(galleryId, user.id);
        if (!gallery) return c.json(apiResponse.error("Gallery not found"), 404);

        const body = await c.req.parseBody();
        const file = body["file"];

        if (!(file instanceof File)) {
            return c.json(apiResponse.error("No file uploaded"), 400);
        }

        const MAX_SIZE = 50 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            return c.json(apiResponse.error("File size exceeds 50MB limit."), 400);
        }

        if (!file.type.startsWith("image/")) {
            return c.json(apiResponse.error("Only image files are allowed."), 400);
        }

        const [newPhoto] = await db.insert(photos).values({
            galleryId,
            filename: file.name,
            originalS3Key: `${user.id}/${galleryId}/original/${crypto.randomUUID()}-${file.name.replace(/\s+/g, "-")}`,
            status: "PENDING",
        }).returning();

        if (!newPhoto) {
            return c.json(apiResponse.error("Failed to create photo record"), 500);
        }

        await withS3Breaker(() =>
            s3.file(newPhoto.originalS3Key).write(file, {
                type: file.type,
            })
        );

        await db.update(photos).set({ status: "PROCESSING" }).where(eq(photos.id, newPhoto.id));

        await photoQueue.add("process-photo", {
            photoId: newPhoto.id,
            userId: user.id,
            galleryId,
            originalS3Key: newPhoto.originalS3Key,
        });

        return c.json(apiResponse.success({ photoId: newPhoto.id }), 202);
    })
    .openapi(listGalleryPhotosRoute, async (c) => {
        const user = c.get("user");
        const { id: galleryId } = c.req.valid("param");

        const gallery = await galleryService.getById(galleryId, user.id);
        if (!gallery) return c.json(apiResponse.error("Gallery not found"), 404);

        const list = await db
            .select({
                id: photos.id,
                filename: photos.filename,
                status: photos.status,
                thumbnailS3Key: photos.thumbnailS3Key,
                watermarkS3Key: photos.watermarkS3Key,
                originalS3Key: photos.originalS3Key,
                selectionCount: db.$count(feedbacks, eq(feedbacks.photoId, photos.id)),
            })
            .from(photos)
            .where(eq(photos.galleryId, galleryId))
            .orderBy(photos.uploadedAt);

        const photoIds = list.map(p => p.id);
        const allFeedbacks = photoIds.length > 0
            ? await db.select().from(feedbacks).where(inArray(feedbacks.photoId, photoIds))
            : [];

        const results = list.map(p => {
            const photoFeedbacks = allFeedbacks.filter(f => f.photoId === p.id);
            return {
                id: p.id,
                filename: p.filename,
                status: p.status,
                thumbnailUrl: buildImageUrl(p.thumbnailS3Key ?? undefined),
                previewUrl: buildImageUrl(p.watermarkS3Key ?? p.originalS3Key ?? undefined),
                selectionCount: p.selectionCount,
                feedbacks: photoFeedbacks.map(f => ({
                    id: f.id,
                    isSelected: f.isSelected,
                    comment: f.comment,
                    clientIdentifier: f.clientIdentifier,
                    createdAt: f.createdAt.toISOString(),
                })),
            };
        });

        return c.json(apiResponse.success(results), 200);
    });

export default routes;
