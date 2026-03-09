import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { apiResponse, createApiResponseSchema, ApiErrorSchema } from "../../lib/response";
import { auth } from "./auth.config";
import { authService } from "./auth.service";

const authRoutes = new OpenAPIHono();

const UploadAvatarResponseSchema = z.object({
    url: z.url().openapi({ example: "https://my-bucket.s3.amazonaws.com/avatar.jpg" }),
});

const uploadAvatarRoute = createRoute({
    summary: "Upload Avatar",
    tags: ["Auth"],
    description: "Upload avatar for authenticated user",
    method: "post",
    path: "/upload-avatar",
    request: {
        body: {
            content: {
                "multipart/form-data": {
                    schema: z.object({
                        file: z.any().openapi({ type: "string", format: "binary" })
                    })
                }
            }
        }
    },
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: createApiResponseSchema(UploadAvatarResponseSchema),
                },
            },
            description: "Avatar uploaded successfully",
        },
        400: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Validation error"),
                },
            },
            description: "Validation error"
        },
        401: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Unauthorized"),
                },
            },
            description: "Unauthorized"
        }
    },
});

const route = authRoutes.openapi(uploadAvatarRoute, async (c) => {
    const session = await auth.api.getSession({
        headers: c.req.raw.headers,
    });

    if (!session || !session.user) {
        return c.json(apiResponse.error("Unauthorized"), 401);
    }

    const body = await c.req.parseBody();
    const file = body["file"] as File;

    if (!file || !file.size) {
        return c.json(apiResponse.error("File is required"), 400);
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        return c.json(apiResponse.error("Only .jpg, .png, and .webp formats are supported."), 400);
    }

    const publicUrl = await authService.uploadAvatar(
        file,
        session.user.id
    );

    const payload = { url: publicUrl };
    return c.json(apiResponse.success(payload, "Avatar uploaded successfully"), 200);
});

// Better Auth Catch-all Handler (must be at the end)
authRoutes.all("*", (c) => {
    return auth.handler(c.req.raw);
});

export type AppType = typeof route;
export default authRoutes;
