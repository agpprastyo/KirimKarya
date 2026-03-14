import { createMiddleware } from "hono/factory";
import { auth } from "../../modules/auth/auth.config";
import { apiResponse } from "../../lib/response";
import type { HonoEnv } from "../types/hono";

export const authMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
    const session = await auth.api.getSession({
        headers: c.req.raw.headers,
    });

    if (!session || !session.user) {
        console.warn("[AuthMiddleware] Unauthorized: No valid session found.", {
            hasHeaders: !!c.req.raw.headers,
            url: c.req.url,
        });
        return c.json(apiResponse.error("Unauthorized"), 401);
    }

    // @ts-ignore - session.user is compatible with our HonoEnv.user
    c.set("user", session.user);
    await next();
});
