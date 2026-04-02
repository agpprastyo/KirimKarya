import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { Scalar } from "@scalar/hono-api-reference";

import { auth } from "./modules/auth/auth.config";
import { env } from "./env";

// Middlewares
import { loggerMiddleware } from "./core/middlewares/logger";
import { errorHandler } from "./core/middlewares/error-handler";
import { authMiddleware } from "./core/middlewares/auth";

// Controllers
import healthRoutes from "./modules/health/health.controller";
import authRoutes from "./modules/auth/auth.controller";
import imagesRoutes from "./modules/images/images.controller";
import galleriesRoutes from "./modules/galleries/galleries.controller";
import photosRoutes from "./modules/photos/photos.controller";
import publicRoutes from "./modules/public/public.controller";
import statsRoutes from "./modules/stats/stats-controller";

import type { HonoEnv } from "./core/types/hono";

export const app = new OpenAPIHono<HonoEnv>().basePath("/api");

// Global Middlewares
app.use("*", requestId());
app.use("*", loggerMiddleware());
app.use(
    "/*",
    cors({
        origin: [env.WEB_URL],
        allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowHeaders: ["Content-Type", "Authorization", "X-Client-Id"],
        exposeHeaders: ["Content-Length"],
        credentials: true,
    })
);

app.use("/galleries", authMiddleware);
app.use("/galleries/*", authMiddleware);
app.use("/photos", authMiddleware);
app.use("/photos/*", authMiddleware);
app.use("/stats", authMiddleware);
app.use("/stats/*", authMiddleware);

app.onError(errorHandler);

app.get(
    "/docs",
    Scalar({
        pageTitle: "Kirim Karya API Documentation",
        theme: "kepler",
        layout: "modern",
        sources: [
            { url: "/api/docs/open-api", title: "Internal API" },
            { url: "/api/docs/better-auth.json", title: "Better Auth API" },
        ],
    })
);

app.doc("/docs/open-api", {
    openapi: "3.0.0",
    info: {
        version: "1.0.0",
        title: "Kirim Karya API",
        description: "Internal REST API for Kirim Karya web application.",
    },
});

app.get("/docs/better-auth.json", async (c) => {
    try {
        const schema = await auth.api.generateOpenAPISchema();
        return c.json(schema);
    } catch (error) {
        return c.json({ error: "Failed to generate Better Auth OpenAPI schema." }, 500);
    }
});

const routes = app
    .route("/health", healthRoutes)
    .route("/auth", authRoutes)
    .route("/images", imagesRoutes)
    .route("/galleries", galleriesRoutes)
    .route("/photos", photosRoutes)
    .route("/public", publicRoutes)
    .route("/stats", statsRoutes);

export type AppType = typeof routes;

export default {
    port: env.PORT,
    fetch: app.fetch,
};
