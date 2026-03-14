import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { apiResponse, createApiResponseSchema } from "../../lib/response";
import { statsService } from "./stats-service";
import type { HonoEnv } from "../../core/types/hono";

const statsRoutes = new OpenAPIHono<HonoEnv>();

const getStatsSummaryRoute = createRoute({
    method: "get",
    path: "/summary",
    summary: "Get Studio Statistics Summary",
    tags: ["Stats"],
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: createApiResponseSchema(z.any()),
                },
            },
            description: "Statistics summary",
        },
    },
});

statsRoutes.openapi(getStatsSummaryRoute, async (c) => {
    const user = c.get("user");
    const summary = await statsService.getSummary(user.id);
    return c.json(apiResponse.success(summary), 200);
});

export default statsRoutes;
