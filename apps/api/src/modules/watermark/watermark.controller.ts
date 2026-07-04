import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { apiResponse, createApiResponseSchema, ApiErrorSchema } from "../../lib/response";
import { db, user, photos, galleries } from "@kirimkarya/db";
import { publishPhotoJob } from "@kirimkarya/queue";
import { redis } from "@kirimkarya/redis";
import { eq } from "drizzle-orm";
import { s3, withS3Breaker } from "@kirimkarya/storage";
import type { HonoEnv } from "../../core/types/hono";
import { UpdateWatermarkSchema, UploadWatermarkImageSchema } from "./watermark.schema";
import Busboy from "busboy";
import { Readable } from "stream";

const watermarkRoutes = new OpenAPIHono<HonoEnv>();

// GET watermark settings
const getWatermarkRoute = createRoute({
    summary: "Get Watermark Settings",
    tags: ["Watermark"],
    method: "get",
    path: "/",
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: createApiResponseSchema(
                        z.object({
                            watermarkType: z.string(),
                            watermarkText: z.string(),
                            watermarkImageKey: z.string().nullable(),
                            watermarkImageUrl: z.string().nullable(),
                            watermarkOpacity: z.number(),
                        })
                    ),
                },
            },
            description: "Watermark settings retrieved successfully",
        },
        401: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Unauthorized"),
                },
            },
            description: "Unauthorized",
        },
    },
});

// UPDATE watermark settings
const updateWatermarkRoute = createRoute({
    summary: "Update Watermark Settings",
    tags: ["Watermark"],
    method: "put",
    path: "/",
    request: {
        body: {
            content: {
                "application/json": {
                    schema: UpdateWatermarkSchema,
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
            description: "Watermark settings updated successfully",
        },
        401: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Unauthorized"),
                },
            },
            description: "Unauthorized",
        },
    },
});

// POST watermark PNG upload
const uploadWatermarkImageRoute = createRoute({
    summary: "Upload PNG Watermark Image",
    tags: ["Watermark"],
    method: "post",
    path: "/image",
    request: {
        body: {
            content: {
                "multipart/form-data": {
                    schema: UploadWatermarkImageSchema,
                },
            },
        },
    },
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: createApiResponseSchema(
                        z.object({
                            key: z.string(),
                            url: z.string(),
                        })
                    ),
                },
            },
            description: "Watermark image uploaded successfully",
        },
        400: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Bad request"),
                },
            },
            description: "Bad request",
        },
        401: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Unauthorized"),
                },
            },
            description: "Unauthorized",
        },
    },
});

// POST regenerate watermark for all user's photos
const regenerateWatermarksRoute = createRoute({
    summary: "Regenerate Watermarks for All Photos",
    tags: ["Watermark"],
    method: "post",
    path: "/regenerate",
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: createApiResponseSchema(
                        z.object({
                            queuedCount: z.number(),
                        })
                    ),
                },
            },
            description: "Watermark regeneration queued successfully",
        },
        401: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Unauthorized"),
                },
            },
            description: "Unauthorized",
        },
        429: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Too Many Requests"),
                },
            },
            description: "Too Many Requests / Rate Limit Exceeded",
        },
    },
});

const routes = watermarkRoutes
    .openapi(getWatermarkRoute, async (c) => {
        const authUser = c.get("user");
        if (!authUser) return c.json(apiResponse.error("Unauthorized"), 401);

        const [currentUser] = await db
            .select({
                watermarkType: user.watermarkType,
                watermarkText: user.watermarkText,
                watermarkImageKey: user.watermarkImageKey,
                watermarkOpacity: user.watermarkOpacity,
            })
            .from(user)
            .where(eq(user.id, authUser.id))
            .limit(1);

        if (!currentUser) return c.json(apiResponse.error("User not found"), 401);

        const watermarkImageUrl = currentUser.watermarkImageKey
            ? `/api/images/${currentUser.watermarkImageKey}`
            : null;

        return c.json(
            apiResponse.success({
                ...currentUser,
                watermarkImageUrl,
            }),
            200
        );
    })
    .openapi(updateWatermarkRoute, async (c) => {
        const authUser = c.get("user");
        if (!authUser) return c.json(apiResponse.error("Unauthorized"), 401);

        const { watermarkType, watermarkText, watermarkOpacity } = c.req.valid("json");

        await db
            .update(user)
            .set({
                watermarkType,
                watermarkText,
                watermarkOpacity,
                updatedAt: new Date(),
            })
            .where(eq(user.id, authUser.id));

        return c.json(apiResponse.success({ success: true }), 200);
    })
    .openapi(uploadWatermarkImageRoute, async (c) => {
        const authUser = c.get("user");
        if (!authUser) return c.json(apiResponse.error("Unauthorized"), 401);

        const MAX_SIZE = 2 * 1024 * 1024; // 2MB max
        const contentLength = c.req.header("content-length");
        if (contentLength && parseInt(contentLength, 10) > MAX_SIZE) {
            return c.json(apiResponse.error("Logo file size exceeds 2MB limit."), 400);
        }

        // Get old watermark image key for cleanup
        const [currentUser] = await db
            .select({ watermarkImageKey: user.watermarkImageKey })
            .from(user)
            .where(eq(user.id, authUser.id))
            .limit(1);

        const key = `${authUser.id}/watermark/${crypto.randomUUID()}.png`;

        try {
            await new Promise<void>((resolve, reject) => {
                const busboy = Busboy({
                    headers: { "content-type": c.req.header("content-type") || "" },
                    limits: { files: 1, fileSize: MAX_SIZE },
                });
                let fileProcessed = false;
                busboy.on("file", async (fieldname, fileStream, info) => {
                    const { filename, mimeType } = info;
                    if (fieldname !== "file") { fileStream.resume(); return; }
                    fileProcessed = true;
                    if (mimeType !== "image/png") {
                        reject(new Error("Only transparent .png format is supported for watermarks."));
                        fileStream.resume();
                        return;
                    }
                    fileStream.on("limit", () => {
                        reject(new Error("Logo file size exceeds 2MB limit."));
                    });
                    const webStream = Readable.toWeb(fileStream);
                    try {
                        const fileRef = s3.file(key);
                        await withS3Breaker(() => fileRef.write(webStream as any, { type: "image/png" }));
                        resolve();
                    } catch (uploadError) {
                        reject(uploadError);
                    }
                });
                busboy.on("error", (err: unknown) => reject(err));
                busboy.on("finish", () => {
                    if (!fileProcessed) {
                        reject(new Error("No file uploaded"));
                    }
                });
                const nodeReqStream = Readable.fromWeb(c.req.raw.body as any);
                nodeReqStream.pipe(busboy);
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to upload watermark image";
            return c.json(apiResponse.error(message), 400);
        }

        // Update database
        await db
            .update(user)
            .set({
                watermarkImageKey: key,
                updatedAt: new Date(),
            })
            .where(eq(user.id, authUser.id));

        // Clean up old watermark file from S3 if it exists
        if (currentUser?.watermarkImageKey) {
            try {
                await s3.file(currentUser.watermarkImageKey).delete();
            } catch (err) {
                console.warn(`[Cleanup] Failed to delete old watermark at ${currentUser.watermarkImageKey}:`, err);
            }
        }

        const publicUrl = `/api/images/${key}`;

        return c.json(
            apiResponse.success({
                key,
                url: publicUrl,
            }),
            200
        );
    })
    .openapi(regenerateWatermarksRoute, async (c) => {
        const authUser = c.get("user");
        if (!authUser) return c.json(apiResponse.error("Unauthorized"), 401);

        const redisKey = `watermark:cooldown:${authUser.id}`;
        const existingCooldown = await redis.get(redisKey);

        if (existingCooldown) {
            const ttl = await redis.ttl(redisKey);
            const minutesLeft = Math.ceil(ttl / 60);
            return c.json(
                apiResponse.error(
                    `Rate limit exceeded. You can only regenerate watermarks once every hour. Please try again in ${minutesLeft} minute(s).`
                ),
                429
            );
        }

        const userPhotos = await db
            .select({
                id: photos.id,
                galleryId: photos.galleryId,
                originalS3Key: photos.originalS3Key,
            })
            .from(photos)
            .innerJoin(galleries, eq(photos.galleryId, galleries.id))
            .where(eq(galleries.userId, authUser.id));

        for (const photo of userPhotos) {
            await db
                .update(photos)
                .set({ status: "PROCESSING" })
                .where(eq(photos.id, photo.id));

            await publishPhotoJob({
                photoId: photo.id,
                userId: authUser.id,
                galleryId: photo.galleryId,
                originalS3Key: photo.originalS3Key,
            });
        }

        // Set 1 hour (3600 seconds) cooldown in Redis to protect server resources
        await redis.set(redisKey, "locked");
        await redis.expire(redisKey, 3600);

        return c.json(
            apiResponse.success({
                queuedCount: userPhotos.length,
            }),
            200
        );
    });

export type AppType = typeof routes;
export default routes;
