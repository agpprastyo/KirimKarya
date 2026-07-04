import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { apiResponse, createApiResponseSchema, ApiErrorSchema, zUuId } from "../../lib/response";
import { CreateGallerySchema, UpdateGallerySchema, GalleryResponseSchema } from "./galleries.schema";
import { galleryService } from "./galleries.service";
import { notificationQueue, deliveryQueue, publishPhotoJob } from "@kirimkarya/queue";
import type { HonoEnv } from "../../core/types/hono";
import { db, photos, feedbacks, galleries } from "@kirimkarya/db";
import { eq, inArray } from "drizzle-orm";
import { s3, withS3Breaker } from "@kirimkarya/storage";
import sharp from "sharp";
import { env } from "@kirimkarya/env";

const apiBaseUrl = env.PUBLIC_API_URL.replace(/\/$/, "");
const buildImageUrl = (key?: string) => key ? `${apiBaseUrl}/api/images/${key}` : null;
import Busboy from "busboy";
import { Readable } from "stream";

const galleriesRoutes = new OpenAPIHono<HonoEnv>();

const listGalleriesRoute = createRoute({
    method: "get",
    path: "/",
    summary: "List Galleries",
    tags: ["Galleries"],
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: createApiResponseSchema(z.array(GalleryResponseSchema)),
                },
            },
            description: "List of galleries",
        },
    },
});

const createGalleryRoute = createRoute({
    method: "post",
    path: "/",
    summary: "Create Gallery",
    tags: ["Galleries"],
    request: {
        body: {
            content: {
                "application/json": {
                    schema: CreateGallerySchema,
                },
            },
        },
    },
    responses: {
        201: {
            content: {
                "application/json": {
                    schema: createApiResponseSchema(GalleryResponseSchema),
                },
            },
            description: "Gallery created",
        },
        500: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Failed to create gallery"),
                },
            },
            description: "Internal Server Error",
        },
    },
});

// Upload Photo to Gallery Route
const uploadPhotoRoute = createRoute({
    method: "post",
    path: "/{id}/photos",
    summary: "Upload Photo",
    tags: ["Photos"],
    request: {
        params: z.object({
            id: zUuId(),
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
                    schema: createApiResponseSchema(z.object({ photoId: zUuId() })),
                },
            },
        },
        400: { description: "Bad Request", content: { "application/json": { schema: ApiErrorSchema("Validation error") } } },
        404: { description: "Gallery not found", content: { "application/json": { schema: ApiErrorSchema("Gallery not found") } } },
        500: { description: "Internal Server Error", content: { "application/json": { schema: ApiErrorSchema("Failed to create photo record") } } },
    },
});

// List Photos in Gallery Route
const listGalleryPhotosRoute = createRoute({
    method: "get",
    path: "/{id}/photos",
    summary: "List Gallery Photos",
    tags: ["Photos"],
    request: {
        params: z.object({
            id: zUuId(),
        }),
    },
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: createApiResponseSchema(z.array(z.object({
                        id: zUuId(),
                        filename: z.string(),
                        status: z.string(),
                        thumbnailUrl: z.string().nullable(),
                        previewUrl: z.string().nullable(),
                        selectionCount: z.number(),
                        feedbacks: z.array(z.object({
                            id: zUuId(),
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
        404: { description: "Gallery not found", content: { "application/json": { schema: ApiErrorSchema("Gallery not found") } } },
    },
});

const getGalleryRoute = createRoute({
    method: "get",
    path: "/{id}",
    summary: "Get Gallery",
    tags: ["Galleries"],
    request: {
        params: z.object({
            id: zUuId(),
        }),
    },
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: createApiResponseSchema(GalleryResponseSchema),
                },
            },
            description: "Gallery detail",
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

const updateGalleryRoute = createRoute({
    method: "put",
    path: "/{id}",
    summary: "Update Gallery",
    tags: ["Galleries"],
    request: {
        params: z.object({
            id: zUuId(),
        }),
        body: {
            content: {
                "application/json": {
                    schema: UpdateGallerySchema,
                },
            },
        },
    },
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: createApiResponseSchema(GalleryResponseSchema),
                },
            },
            description: "Gallery updated",
        },
        404: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Gallery not found"),
                },
            },
            description: "Not found",
        },
        500: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Failed to update gallery"),
                },
            },
            description: "Internal Server Error",
        },
    },
});

const deliverGalleryRoute = createRoute({
    method: "post",
    path: "/{id}/deliver",
    summary: "Initiate High-Res Photo Delivery",
    tags: ["Galleries"],
    request: {
        params: z.object({
            id: zUuId(),
        }),
    },
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: createApiResponseSchema(z.object({ success: z.boolean() })),
                },
            },
            description: "Delivery initiated",
        },
        400: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("No photos selected for delivery"),
                },
            },
            description: "Bad Request",
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

const deleteGalleryRoute = createRoute({
    method: "delete",
    path: "/{id}",
    summary: "Delete Gallery",
    tags: ["Galleries"],
    request: {
        params: z.object({
            id: zUuId(),
        }),
    },
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: createApiResponseSchema(z.object({ success: z.boolean() })),
                },
            },
            description: "Gallery deleted",
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

const routes = galleriesRoutes
    .openapi(listGalleriesRoute, async (c) => {
        const user = c.get("user");
        const list = await galleryService.listByUserId(user.id);
        return c.json(apiResponse.success(list), 200);
    })
    .openapi(createGalleryRoute, async (c) => {
        const user = c.get("user");
        const body = c.req.valid("json");
        const newGallery = await galleryService.create(user.id, body);
        if (!newGallery) return c.json(apiResponse.error("Failed to create gallery"), 500);
        return c.json(apiResponse.success(newGallery), 201);
    })
    .openapi(getGalleryRoute, async (c) => {
        const user = c.get("user");
        const { id } = c.req.valid("param");
        const gallery = await galleryService.getById(id, user.id);
        if (!gallery) return c.json(apiResponse.error("Gallery not found"), 404);

        return c.json(apiResponse.success(gallery), 200);
    })
    .openapi(uploadPhotoRoute, async (c) => {
        const user = c.get("user");
        const { id: galleryId } = c.req.valid("param");
        console.log(`[Upload Debug] Step 1: Handler entered for gallery ${galleryId}`);
        const gallery = await galleryService.getById(galleryId, user.id);
        if (!gallery) return c.json(apiResponse.error("Gallery not found"), 404);
        console.log(`[Upload Debug] Step 2: Gallery found`);

        const MAX_SIZE = 50 * 1024 * 1024;
        
        let file: File | null = null;
        try {
            console.log(`[Upload Debug] Step 3: Parsing body...`);
            const body = await c.req.parseBody();
            file = body["file"] as File;
            console.log(`[Upload Debug] Step 3: Body parsed, file: ${file?.name}, size: ${file?.size}`);
        } catch (err: unknown) {
            console.error(`[Upload Debug] Step 3 FAILED: parseBody error`, err);
            return c.json(apiResponse.error("Failed to parse form data"), 400);
        }

        if (!file || !(file instanceof File)) {
            console.warn(`[Upload Debug] No file in body`);
            return c.json(apiResponse.error("No file uploaded"), 400);
        }

        if (file.size > MAX_SIZE) {
            return c.json(apiResponse.error("File size exceeds 50MB limit."), 400);
        }

        if (!file.type.startsWith("image/")) {
            return c.json(apiResponse.error("Only image files are allowed."), 400);
        }

        const originalS3Key = `${user.id}/${galleryId}/original/${crypto.randomUUID()}-${file.name.replace(/\s+/g, "-")}`;
        
        let newPhoto: typeof photos.$inferSelect | null = null;
        try {
            console.log(`[Upload Debug] Step 4: Inserting DB record...`);
            const [inserted] = await db.insert(photos).values({
                galleryId,
                filename: file.name,
                originalS3Key,
                status: "PENDING"
            }).returning();
            newPhoto = inserted || null;
            console.log(`[Upload Debug] Step 4: DB record created, id: ${newPhoto?.id}`);
        } catch (dbErr: unknown) {
            console.error(`[Upload Debug] Step 4 FAILED: DB insert error`, dbErr);
            return c.json(apiResponse.error("Failed to create photo record"), 500);
        }

        if (!newPhoto) {
            return c.json(apiResponse.error("Failed to create photo record"), 500);
        }

        try {
            console.log(`[Upload Debug] Step 5: Uploading to S3... key: ${originalS3Key}`);
            const arrayBuffer = await file.arrayBuffer();
            console.log(`[Upload Debug] Step 5a: arrayBuffer ready, size: ${arrayBuffer.byteLength}`);
            await s3.file(originalS3Key).write(Buffer.from(arrayBuffer), {
                type: file!.type,
            });
            console.log(`[Upload Debug] Step 5: S3 upload complete`);
        } catch (uploadError: unknown) {
            console.error(`[Upload Debug] Step 5 FAILED: S3 upload error`, uploadError);
            await db.delete(photos).where(eq(photos.id, newPhoto.id)).catch(() => {});
            return c.json(apiResponse.error("Failed to upload photo to storage"), 500);
        }

        console.log(`[Upload Debug] Step 6: Updating status to PROCESSING...`);
        await db.update(photos).set({ status: "PROCESSING" }).where(eq(photos.id, newPhoto.id));

        console.log(`[Upload Debug] Step 7: Publishing photo job via Redis...`);
        // Use Bun's native Redis PUBLISH instead of BullMQ's ioredis (which hangs
        // in Bun.serve context). Worker subscribes and forwards to BullMQ.
        await publishPhotoJob({
            photoId: newPhoto.id,
            userId: user.id,
            galleryId,
            originalS3Key: newPhoto.originalS3Key,
        });
        console.log(`[Upload Debug] Step 7a: ✅ Photo job published for ${newPhoto.id}`);

        console.log(`[Upload Debug] Step 8: DONE! Returning 202`);
        return c.json(apiResponse.success({ photoId: newPhoto.id }), 202);
    })
    .openapi(listGalleryPhotosRoute, async (c) => {
        const user = c.get("user");
        const { id: galleryId } = c.req.valid("param");
        const gallery = await galleryService.getById(galleryId, user.id);
        if (!gallery) return c.json(apiResponse.error("Gallery not found"), 404);
        const list = await db.select({
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
        const allFeedbacks = photoIds.length > 0 ? await db.select().from(feedbacks).where(inArray(feedbacks.photoId, photoIds)) : [];
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
    })
    .openapi(updateGalleryRoute, async (c) => {
        const user = c.get("user");
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");

        const oldGallery = await galleryService.getById(id, user.id);
        if (!oldGallery) return c.json(apiResponse.error("Gallery not found"), 404);

        const updatedGallery = await galleryService.update(id, user.id, body);
        if (!updatedGallery) return c.json(apiResponse.error("Failed to update gallery"), 500);

        const shouldNotify = body.notify || (oldGallery.status !== "PUBLISHED" && updatedGallery.status === "PUBLISHED");

        if (shouldNotify && updatedGallery.status === "PUBLISHED") {
            await notificationQueue.add(`gallery_notified_${id}_${Date.now()}`, {
                type: "GALLERY_PUBLISHED",
                galleryId: id,
                userId: user.id,
            });
        }

        return c.json(apiResponse.success(updatedGallery), 200);
    })
    .openapi(deliverGalleryRoute, async (c) => {
        const user = c.get("user");
        const { id } = c.req.valid("param");

        const gallery = await galleryService.getById(id, user.id);
        if (!gallery) return c.json(apiResponse.error("Gallery not found"), 404);

        const selectionCount = await galleryService.countSelectedPhotos(id);
        if (selectionCount === 0) {
            return c.json(apiResponse.error("No photos selected for delivery"), 400);
        }

        // Update status to QUEUED
        await galleryService.update(id, user.id, { deliveryStatus: "QUEUED" });

        // Add delivery job
        await deliveryQueue.add("GALLERY_DELIVERY", {
            type: "GALLERY_DELIVERY",
            galleryId: id,
            userId: user.id,
        });

        return c.json(apiResponse.success({ success: true }), 200);
    })
    .openapi(deleteGalleryRoute, async (c) => {
        const user = c.get("user");
        const { id } = c.req.valid("param");

        const gallery = await galleryService.getById(id, user.id);
        if (!gallery) return c.json(apiResponse.error("Gallery not found"), 404);

        await galleryService.delete(id, user.id);
        return c.json(apiResponse.success({ success: true }), 200);
    });

export default routes;
