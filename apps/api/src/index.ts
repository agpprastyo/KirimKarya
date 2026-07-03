import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { Scalar } from "@scalar/hono-api-reference";

import { auth } from "./modules/auth/auth.config";
import { env } from "@kirimkarya/env";

// Middlewares
import { loggerMiddleware } from "./core/middlewares/logger";
import { errorHandler } from "./core/middlewares/error-handler";
import { authMiddleware } from "./core/middlewares/auth";
import { rateLimiterMiddleware } from "./core/middlewares/rate-limiter";

// Controllers
import healthRoutes from "./modules/health/health.controller";
import authRoutes from "./modules/auth/auth.controller";
import imagesRoutes from "./modules/images/images.controller";
import galleriesRoutes from "./modules/galleries/galleries.controller";
import photosRoutes from "./modules/photos/photos.controller";
import publicRoutes from "./modules/public/public.controller";
import statsRoutes from "./modules/stats/stats.controller";
import watermarkRoutes from "./modules/watermark/watermark.controller";
import adminRoutes from "./modules/admin/admin.controller";
import { adminMiddleware } from "./core/middlewares/admin";
import { observabilityRouter } from "./modules/observability/observability.controller";
import { tracingMiddleware } from "./core/middlewares/tracing";

import type { HonoEnv } from "./core/types/hono";

export const app = new OpenAPIHono<HonoEnv>();

// Global Middlewares
app.use("*", requestId());
app.use("*", tracingMiddleware());
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

app.use("/*", rateLimiterMiddleware());

// Auth Middleware Registrations (securer legacy and versioned endpoints)
const securePaths = ["/api/galleries", "/api/v1/galleries", "/api/photos", "/api/v1/photos", "/api/stats", "/api/v1/stats", "/api/watermark", "/api/v1/watermark"];
for (const p of securePaths) {
    app.use(p, authMiddleware);
    app.use(`${p}/*`, authMiddleware);
}

const secureAdminPaths = ["/api/admin", "/api/v1/admin"];
for (const p of secureAdminPaths) {
    app.use(p, adminMiddleware);
    app.use(`${p}/*`, adminMiddleware);
}

app.onError(errorHandler);

// Scalar OpenAPI Documentation
app.get(
    "/api/docs",
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

app.doc("/api/docs/open-api", {
    openapi: "3.0.0",
    info: {
        version: "1.0.0",
        title: "Kirim Karya API",
        description: "Internal REST API for Kirim Karya web application.",
    },
});

app.get("/api/docs/better-auth.json", async (c) => {
    try {
        const schema = await auth.api.generateOpenAPISchema();
        return c.json(schema);
    } catch (error) {
        return c.json({ error: "Failed to generate Better Auth OpenAPI schema." }, 500);
    }
});

// Chained Routing Definition: Registers BOTH versioned and legacy paths to guarantee
// SvelteKit Web compatibility for public pages and Dashboard UI.
const routes = app
    .route("/api/auth", authRoutes)
    .route("/api/observability", observabilityRouter)
    .route("/api/v1/health", healthRoutes)
    .route("/api/v1/auth", authRoutes)
    .route("/api/v1/images", imagesRoutes)
    .route("/api/v1/galleries", galleriesRoutes)
    .route("/api/v1/photos", photosRoutes)
    .route("/api/v1/public", publicRoutes)
    .route("/api/v1/stats", statsRoutes)
    .route("/api/v1/watermark", watermarkRoutes)
    .route("/api/v1/admin", adminRoutes)
    .route("/api/health", healthRoutes)
    .route("/api/images", imagesRoutes)
    .route("/api/galleries", galleriesRoutes)
    .route("/api/photos", photosRoutes)
    .route("/api/public", publicRoutes)
    .route("/api/stats", statsRoutes)
    .route("/api/watermark", watermarkRoutes)
    .route("/api/admin", adminRoutes);

export type AppType = typeof routes;

let server: ReturnType<typeof Bun.serve> | undefined;
if (process.env.NODE_ENV !== "test") {
    server = Bun.serve({
        port: env.PORT,
        fetch: app.fetch,
    });

    console.log(`[API] Server is running on port ${server.port}`);

    const shutdown = async (signal: string) => {
        console.log(`\n[API] Received ${signal}. Starting graceful shutdown...`);
        
        // Set a safety fallback exit timeout of 5 seconds
        const timeout = setTimeout(() => {
            console.error("[API] Graceful shutdown timed out. Forcing exit.");
            process.exit(1);
        }, 5000);
        
        try {
            console.log("[API] Stopping HTTP server...");
            server?.stop(true);
            console.log("[API] HTTP server stopped accepting new requests.");
        } catch (err: unknown) {
            console.error("[API] Failed to stop HTTP server:", err instanceof Error ? err.message : String(err));
        }

        try {
            const { pgClient } = await import("@kirimkarya/db");
            console.log("[API] Closing database connection pool...");
            await pgClient.end();
            console.log("[API] Database connection pool closed gracefully.");
        } catch (err: unknown) {
            console.error("[API] Failed to close database connection pool:", err instanceof Error ? err.message : String(err));
        }
        
        try {
            const { redis } = await import("@kirimkarya/redis");
            await redis.close();
            console.log("[API] Redis connection closed gracefully.");
        } catch (err: unknown) {
            console.error("[API] Failed to close Redis connection:", err instanceof Error ? err.message : String(err));
        }
        
        clearTimeout(timeout);
        console.log("[API] Graceful shutdown completed. Exiting process.");
        process.exit(0);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
}

export default server;
