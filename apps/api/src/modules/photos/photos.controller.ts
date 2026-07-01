import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { apiResponse, createApiResponseSchema, ApiErrorSchema } from "../../lib/response";
import { galleryService } from "../galleries/galleries.service";
import { s3, withS3Breaker } from "@kirimkarya/storage";
import { db, photos, feedbacks, galleries } from "@kirimkarya/db";
import { eq, and, inArray } from "drizzle-orm";
import { photoQueue } from "@kirimkarya/queue";
import sharp from "sharp";
import type { HonoEnv } from "../../core/types/hono";
import { env } from "@kirimkarya/env";
import Busboy from "busboy";
import { Readable } from "stream";

const photosRoutes = new OpenAPIHono<HonoEnv>();
const apiBaseUrl = env.PUBLIC_API_URL.replace(/\/$/, "");
const buildImageUrl = (key?: string) =>
    key ? `${apiBaseUrl}/api/images/${key}` : null;

// Upload route moved to galleries controller

// List route moved to galleries controller

const deletePhotosRoute = createRoute({
    method: "post",
    path: "/bulk-delete",
    summary: "Bulk Delete Photos",
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
        
        await db.transaction(async (tx) => {
            await tx.delete(feedbacks).where(inArray(feedbacks.photoId, targetIds));
            await tx.delete(photos).where(inArray(photos.id, targetIds));
        });

        return c.json(apiResponse.success({ deletedCount: targetIds.length }), 200);
    })
    // upload route moved to galleries controller
    // list route moved to galleries controller;

export default routes;
