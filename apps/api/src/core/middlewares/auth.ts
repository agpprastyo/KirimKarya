import { createMiddleware } from "hono/factory";
import { auth } from "../../modules/auth/auth.config";
import { apiResponse } from "../../lib/response";
import type { HonoEnv } from "../types/hono";

export const authMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
    console.log(`[AuthMiddleware] Checking session for: ${c.req.url}`);
    const session = await auth.api.getSession({
        headers: c.req.raw.headers,
    });
    console.log(`[AuthMiddleware] Session found: ${!!session?.user}`);

    if (!session || !session.user) {
        console.warn("[AuthMiddleware] Unauthorized: No valid session found.", {
            hasHeaders: !!c.req.raw.headers,
            url: c.req.url,
        });
        return c.json(apiResponse.error("Unauthorized"), 401);
    }

    c.set("user", session.user as any);
    await next();
});
