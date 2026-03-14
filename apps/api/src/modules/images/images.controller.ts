import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { imagesService } from "./images.service";
import { ApiErrorSchema } from "../../lib/response";

const imagesRoutes = new OpenAPIHono();

const getImageRoute = createRoute({
    method: "get",
    path: "/*",
    summary: "Get Image",
    description: "Retrieves an image from the storage bucket. Supports nested paths.",
    tags: ["Images"],
    request: {},
    responses: {
        200: {
            content: {
                "image/*": {
                    schema: {
                        type: "string",
                        format: "binary",
                    },
                },
            },
            description: "Image retrieved successfully",
        },
        404: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Image not found"),
                },
            },
            description: "Image not found",
        },
    },
});

const route = imagesRoutes.openapi(getImageRoute, async (c) => {
    const user = (c as any).get("user");

    const fullPath = new URL(c.req.url).pathname;
    const key = fullPath.replace("/api/images/", "");

    if (!key.startsWith(`${user.id}/`)) {
        console.warn(`[Security] User ${user.id} attempted to access unauthorized key: ${key}`);
        return c.json({ error: "Forbidden" }, 403);
    }

    const { bytes, contentType } = await imagesService.getImage(key);

    return c.body(bytes as any, 200, {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
    });
});

export type AppType = typeof route;
export default imagesRoutes;
