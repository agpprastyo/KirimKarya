import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { apiResponse, createApiResponseSchema, ApiErrorSchema } from "../../lib/response";
import { CreateGallerySchema, UpdateGallerySchema, GalleryResponseSchema } from "./galleries.schema";
import { galleryService } from "./galleries.service";
import { notificationQueue, deliveryQueue } from "@kirimkarya/queue";
import type { HonoEnv } from "../../core/types/hono";

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

const getGalleryRoute = createRoute({
    method: "get",
    path: "/{id}",
    summary: "Get Gallery",
    tags: ["Galleries"],
    request: {
        params: z.object({
            id: z.string().uuid(),
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
            id: z.string().uuid(),
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
            id: z.string().uuid(),
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
        await deliveryQueue.add(`gallery_delivery_${id}`, {
            type: "GALLERY_DELIVERY",
            galleryId: id,
            userId: user.id,
        });

        return c.json(apiResponse.success({ success: true }), 200);
    });

export default routes;
