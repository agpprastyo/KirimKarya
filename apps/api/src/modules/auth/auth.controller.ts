import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { apiResponse, createApiResponseSchema, ApiErrorSchema } from "../../lib/response";
import { auth } from "./auth.config";
import { authService } from "./auth.service";
import Busboy from "busboy";
import { Readable } from "stream";

const authRoutes = new OpenAPIHono();

const UploadAvatarResponseSchema = z.object({
    url: z.url().openapi({ example: "https://my-bucket.s3.amazonaws.com/avatar.jpg" }),
});

const uploadAvatarRoute = createRoute({
    summary: "Upload Avatar",
    tags: ["Auth"],
    description: "Upload avatar for authenticated user (max 5MB, JPG/PNG/WebP)",
    method: "post",
    path: "/avatar",
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

const routes = authRoutes.openapi(uploadAvatarRoute, async (c) => {
    const session = await auth.api.getSession({
        headers: c.req.raw.headers,
    });

    if (!session || !session.user) {
        return c.json(apiResponse.error("Unauthorized"), 401);
    }

    const MAX_SIZE = 5 * 1024 * 1024;
    const contentLength = c.req.header("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_SIZE) {
        return c.json(apiResponse.error("File size exceeds 5MB limit."), 400);
    }

    let publicUrl: string | null = null;
    try {
        publicUrl = await new Promise<string>((resolve, reject) => {
            const busboy = Busboy({
                headers: { "content-type": c.req.header("content-type") || "" },
                limits: { files: 1, fileSize: MAX_SIZE },
            });
            let fileProcessed = false;
            busboy.on("file", async (fieldname, fileStream, info) => {
                const { filename, mimeType } = info;
                if (fieldname !== "file") { fileStream.resume(); return; }
                fileProcessed = true;
                if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
                    reject(new Error("Only .jpg, .png, and .webp formats are supported."));
                    fileStream.resume();
                    return;
                }
                fileStream.on("limit", () => {
                    reject(new Error("File size exceeds 5MB limit."));
                });
                try {
                    const url = await authService.uploadAvatarStream(
                        fileStream,
                        session.user.id,
                        mimeType
                    );
                    resolve(url);
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
            const nodeReqStream = Readable.from(c.req.raw.body as any);
            nodeReqStream.pipe(busboy);
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to upload avatar";
        return c.json(apiResponse.error(message), 400);
    }

    const payload = { url: publicUrl };
    return c.json(apiResponse.success(payload, "Avatar uploaded successfully"), 200);
}).all("*", async (c) => {
    console.log(`[AuthHandler] Handling: ${c.req.url}`);
    const res = await auth.handler(c.req.raw);
    console.log(`[AuthHandler] Response status: ${res.status}`);
    return res;
});

export type AppType = typeof routes;
export default routes;
