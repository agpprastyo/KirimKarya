import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { getCookie } from "hono/cookie";
import { auth } from "../auth/auth.config";
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

const routes = imagesRoutes.openapi(getImageRoute, async (c) => {
    const user = (c as any).get("user");

    const fullPath = new URL(c.req.url).pathname;
    const key = fullPath.replace("/api/images/", "");

    const isPublicPath = key.includes("uploads/") || key.includes("avatar/");

    if (!isPublicPath) {
        let authUser = user;

        if (!authUser) {
            const session = await auth.api.getSession({
                headers: c.req.raw.headers,
            });
            authUser = session?.user;
        }

        if (!authUser) {
            const parts = key.split("/");
            if (parts.length >= 2) {
                const galleryId = parts[1];
                const accessCookie = getCookie(c, `gallery_access_${galleryId}`);

                if (accessCookie) {
                    const { bytes, contentType } = await imagesService.getImage(key);
                    return c.body(bytes as any, 200, {
                        "Content-Type": contentType,
                        "Cache-Control": "public, max-age=31536000, immutable",
                    });
                }
            }
        }

        if (!authUser) {
            return c.json({ error: "Unauthorized" }, 401);
        }

        if (!key.startsWith(`${authUser.id}/`)) {
            console.warn(`[Security] Unauthorized access attempt to key: ${key} by user: ${authUser.id}`);
            return c.json({ error: "Forbidden" }, 403);
        }
    }

    const { bytes, contentType } = await imagesService.getImage(key);

    return c.body(bytes as any, 200, {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
    });
});

export type AppType = typeof routes;
export default routes;
