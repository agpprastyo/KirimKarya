import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { apiResponse, createApiResponseSchema, ApiErrorSchema } from "../../lib/response";
import { storageService } from "./storage.service";

const storageRoutes = new OpenAPIHono();

const UploadStorageResponseSchema = z.object({
    url: z.url().openapi({ example: "https://my-bucket.s3.amazonaws.com/file.pdf" }),
});

const uploadRoute = createRoute({
    summary: "Upload File",
    description: "Uploads a generic file to the storage bucket",
    tag: ["Storage"],
    method: "post",
    path: "/upload",
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
                    schema: createApiResponseSchema(UploadStorageResponseSchema),
                },
            },
            description: "File uploaded successfully",
        },
        400: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Validation error"),
                },
            },
            description: "Validation error"
        }
    },
});

const route = storageRoutes.openapi(uploadRoute, async (c) => {
    const user = (c as any).get("user");
    const body = await c.req.parseBody();
    const file = body["file"] as File;

    if (!file) {
        return c.json(apiResponse.error("No file provided"), 400);
    }

    const publicUrl = await storageService.uploadFile(file, user.id);

    const payload = { url: publicUrl };
    return c.json(apiResponse.success(payload, "File uploaded successfully"), 200);
});

export type AppType = typeof route;
export default storageRoutes;
