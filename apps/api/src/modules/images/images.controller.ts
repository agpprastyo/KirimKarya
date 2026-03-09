import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { imagesService } from "./images.service";
import { ApiErrorSchema } from "../../lib/response";

const imagesRoutes = new OpenAPIHono();

const getImageRoute = createRoute({
    summary: "Get Image",
    description: "Retrieves an image from the storage bucket",
    tag: ["Images"],
    method: "get",
    path: "/{key}",
    request: {
        params: z.object({
            key: z.string().openapi({ param: { name: "key", in: "path" }, example: "avatar.jpg" }),
        }),
    },
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
    const key = c.req.param("key");
    const { bytes, contentType } = await imagesService.getImage(key);

    return c.body(bytes as any, 200, {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
    });
});

export type AppType = typeof route;
export default imagesRoutes;
