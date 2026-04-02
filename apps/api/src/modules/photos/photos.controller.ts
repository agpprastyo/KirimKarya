import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { apiResponse, createApiResponseSchema, ApiErrorSchema } from "../../lib/response";
import { galleryService } from "../galleries/galleries.service";
import { s3 } from "@kirimkarya/storage";
import { db, photos, feedbacks, eq } from "@kirimkarya/db";
import { photoQueue } from "@kirimkarya/queue";
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
                        selectionCount: z.number(),
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

const routes = photosRoutes
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

        await s3.file(newPhoto.originalS3Key).write(Buffer.from(await file.arrayBuffer()), {
            type: file.type,
        });

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
                selectionCount: db.$count(feedbacks, eq(feedbacks.photoId, photos.id)),
            })
            .from(photos)
            .where(eq(photos.galleryId, galleryId))
            .orderBy(photos.uploadedAt);

        const results = list.map(p => ({
            id: p.id,
            filename: p.filename,
            status: p.status,
            thumbnailUrl: buildImageUrl(p.thumbnailS3Key ?? undefined),
            selectionCount: p.selectionCount,
        }));

        return c.json(apiResponse.success(results), 200);
    });

export default routes;
