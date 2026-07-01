import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { apiResponse, createApiResponseSchema } from "../../lib/response";
import { StatsSummaryResponseSchema, StatsInsightsResponseSchema, StatsClientsResponseSchema } from "./stats.schema";
import { statsService } from "./stats.service";
import { notificationQueue } from "@kirimkarya/queue";
import type { HonoEnv } from "../../core/types/hono";

const statsRoutes = new OpenAPIHono<HonoEnv>();

const getStatsSummaryRoute = createRoute({
    method: "get",
    path: "/summary",
    summary: "Get Studio Statistics Summary",
    tags: ["Stats"],
    responses: {
        200: {
            content: { "application/json": { schema: createApiResponseSchema(StatsSummaryResponseSchema) } },
            description: "Statistics summary",
        },
    },
});

const getStatsInsightsRoute = createRoute({
    method: "get",
    path: "/insights",
    summary: "Get Analytics Insights (Funnel, Timeseries, Top Clients)",
    tags: ["Stats"],
    responses: {
        200: {
            content: { "application/json": { schema: createApiResponseSchema(StatsInsightsResponseSchema) } },
            description: "Analytics insights",
        },
    },
});

const getAllClientsRoute = createRoute({
    method: "get",
    path: "/clients",
    summary: "Get All Clients CRM Data",
    tags: ["Stats"],
    responses: {
        200: {
            content: { "application/json": { schema: createApiResponseSchema(StatsClientsResponseSchema) } },
            description: "All clients data",
        },
    },
});

const sendClientReminderRoute = createRoute({
    method: "post",
    path: "/clients/send-reminder",
    summary: "Send Email Reminder to Client",
    tags: ["Stats"],
    request: {
        body: {
            content: {
                "application/json": {
                    schema: z.object({
                        clientEmail: z.string().email(),
                        galleryId: z.string().uuid(),
                        message: z.string().min(1),
                    }),
                },
            },
        },
    },
    responses: {
        200: {
            content: { "application/json": { schema: createApiResponseSchema(z.object({ success: z.boolean() })) } },
            description: "Reminder email sent successfully",
        },
    },
});

const routes = statsRoutes
    .openapi(getStatsSummaryRoute, async (c) => {
        const user = c.get("user");
        const summary = await statsService.getSummary(user.id);
        return c.json(apiResponse.success(summary), 200);
    })
    .openapi(getStatsInsightsRoute, async (c) => {
        const user = c.get("user");
        const insights = await statsService.getInsights(user.id);
        return c.json(apiResponse.success(insights), 200);
    })
    .openapi(getAllClientsRoute, async (c) => {
        const user = c.get("user");
        const clients = await statsService.getAllClients(user.id);
        return c.json(apiResponse.success(clients), 200);
    })
    .openapi(sendClientReminderRoute, async (c) => {
        const user = c.get("user");
        const { clientEmail, galleryId, message } = c.req.valid("json");

        await notificationQueue.add(`client_reminder_${galleryId}_${clientEmail}_${Date.now()}`, {
            type: "CLIENT_REMINDER",
            galleryId,
            userId: user.id,
            data: { clientEmail, message }
        });

        return c.json(apiResponse.success({ success: true }), 200);
    });

export default routes;
