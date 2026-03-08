import { auth } from "./auth";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { storage } from "./routes/storage";
import { images } from "./routes/images";
import { avatar } from "./routes/auth-avatar";
import { health } from "./routes/health";
import { apiResponse } from "./lib/response";


const app = new Hono();

app.use(
    "/api/*",
    cors({
        origin: ["http://localhost:5173"],
        allowMethods: ["POST", "GET", "OPTIONS"],
        allowHeaders: ["Content-Type", "Authorization"],
        exposeHeaders: ["Content-Length"],
        credentials: true,
    })
);

app.get("/", (c) => {
    return apiResponse.success(c, { health: "ok" }, "Kirim Karya API is running!");
});

app.route("/api/health", health);
app.route("/api/storage", storage);
app.route("/api/images", images);

// Better Auth & Custom Auth Routes
app.on(["POST", "GET"], "/api/auth/**", (c) => {
    if (c.req.path === "/api/auth/upload-avatar" && c.req.method === "POST") {
        return avatar.fetch(c.req.raw);
    }
    return auth.handler(c.req.raw);
});

export default {
    port: process.env.PORT || 3000,
    fetch: app.fetch,
};
