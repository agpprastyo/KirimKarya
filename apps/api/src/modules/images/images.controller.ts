import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { getCookie } from "hono/cookie";
import { auth } from "../auth/auth.config";
import { imagesService } from "./images.service";
import { ApiErrorSchema } from "../../lib/response";
import { db, galleries } from "@kirimkarya/db";
import { eq } from "drizzle-orm";
import { publicService } from "../public/public.service";
import { redis } from "@kirimkarya/redis";

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
    const rawKey = fullPath.replace("/api/images/", "");

    // SEC-2: Sanitize key to prevent path traversal
    // Normalize the path and reject any key that tries to escape with ../
    const key = rawKey.replace(/\\/g, "/").replace(/\.\.+\//g, "").replace(/^\/+/, "");

    if (!key || key.includes("..")) {
        return c.json({ error: "Forbidden" }, 403);
    }

    // SEC-2: Use startsWith() — not includes() — to prevent bypass via crafted paths
    const isPublicPath = key.startsWith("uploads/") || key.startsWith("avatar/");

    if (!isPublicPath) {
        let authUser = user;
        if (!authUser) {
            try {
                const session = await auth.api.getSession({
                    headers: c.req.raw.headers,
                });
                authUser = session?.user;
            } catch {}
        }

        // 1. Owner check: If logged-in user owns the resource, allow access
        const isOwner = authUser ? key.startsWith(`${authUser.id}/`) : false;

        if (!isOwner) {
            // 2. Guest check: Check if guest access is allowed
            let isGuestAllowed = false;
            const parts = key.split("/");
            if (parts.length >= 3) {
                const galleryId = parts[1]!;
                const fileType = parts[2]!; // "thumbs" | "watermarks" | "previews"

                if (fileType === "thumbs" || fileType === "previews" || fileType === "watermarks") {
                    const [gallery] = await db
                        .select({ isPrivate: galleries.isPrivate, status: galleries.status })
                        .from(galleries)
                        .where(eq(galleries.id, galleryId));

                    if (gallery && gallery.status === "PUBLISHED") {
                        const accessCookie = getCookie(c, `gallery_access_${galleryId}`);
                        const hasAccessCookie = accessCookie ? !!(await redis.get(`access_token:${galleryId}:${accessCookie}`)) : false;

                        if (!gallery.isPrivate || hasAccessCookie) {
                            isGuestAllowed = true;
                        }
                    }
                }
            }

            if (!isGuestAllowed) {
                if (authUser) {
                    console.warn(`[Security] Forbidden access attempt to key: ${key} by user: ${authUser.id}`);
                    return c.json({ error: "Forbidden" }, 403);
                } else {
                    return c.json({ error: "Unauthorized" }, 401);
                }
            }
        }
    }

    const { stream, contentType } = await imagesService.getImageStream(key);

    return c.body(stream as any, 200, {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
    });
});

export type AppType = typeof routes;
export default routes;
