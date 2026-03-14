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
import storageRoutes from "./modules/storage/storage.controller";
import imagesRoutes from "./modules/images/images.controller";
import galleriesRoutes from "./modules/galleries/galleries.controller";
import photosRoutes from "./modules/photos/photos.controller";
import publicRoutes from "./modules/public/public.controller";
import statsRoutes from "./modules/stats/stats-controller";

const app = new OpenAPIHono();

// Global Middlewares
app.use("*", requestId());
app.use("*", loggerMiddleware());
app.use(
    "/api/*",
    cors({
        origin: [env.WEB_URL],
        allowMethods: ["POST", "GET", "OPTIONS"],
        allowHeaders: ["Content-Type", "Authorization", "X-Client-Id"],
        exposeHeaders: ["Content-Length"],
        credentials: true,
    })
);

app.use("/api/storage", authMiddleware);
app.use("/api/storage/*", authMiddleware);
app.use("/api/images", authMiddleware);
app.use("/api/images/*", authMiddleware);
app.use("/api/galleries", authMiddleware);
app.use("/api/galleries/*", authMiddleware);
app.use("/api/photos", authMiddleware);
app.use("/api/photos/*", authMiddleware);
app.use("/api/stats", authMiddleware);
app.use("/api/stats/*", authMiddleware);

app.onError(errorHandler);

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

const routes = app
    .route("/api/health", healthRoutes)
    .route("/api/auth", authRoutes)
    .route("/api/storage", storageRoutes)
    .route("/api/images", imagesRoutes)
    .route("/api/galleries", galleriesRoutes)
    .route("/api/photos", photosRoutes)
    .route("/api/public", publicRoutes)
    .route("/api/stats", statsRoutes);

export type AppType = typeof routes;

export default {
    port: env.PORT,
    fetch: app.fetch,
};
