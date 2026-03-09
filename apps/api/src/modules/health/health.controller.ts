import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { ApiErrorSchema, apiResponse, createApiResponseSchema } from "../../lib/response";

const healthRoutes = new OpenAPIHono();

const HealthSchema = z.object({
    health: z.string().openapi({ example: "ok" }),
    services: z.object({
        auth: z.string().openapi({ example: "READY" }),
        db: z.string().openapi({ example: "READY" }),
        redis: z.string().openapi({ example: "READY" }),
        s3: z.string().openapi({ example: "READY" }),
    }),
    timestamp: z.string().openapi({ example: "2024-01-01T00:00:00.000Z" }),
});

const getHealthRoute = createRoute({
    summary: "Health Check",
    tags: ["Health"],
    description: "Kirim Karya API Health Check",
    method: "get",
    path: "/",
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: createApiResponseSchema(HealthSchema),
                },
            },
            description: "Kirim Karya API Health Check",
        },
        500: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Internal Server Error"),
                },
            },
            description: "Internal Server Error",
        },
    },
});

const app = healthRoutes.openapi(getHealthRoute, (c) => {
    const payload = {
        health: "ok",
        services: {
            auth: "READY",
            db: "READY",
            redis: "READY",
            s3: "READY",
        },
        timestamp: new Date().toISOString(),
    };
    return c.json(apiResponse.success(payload, "Kirim Karya API is running!"), 200);
});

export type AppType = typeof app;
export default healthRoutes;
