import { createMiddleware } from "hono/factory";
import { auth } from "../../modules/auth/auth.config";
import { apiResponse } from "../../lib/response";
import type { HonoEnv } from "../types/hono";

export const adminMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
    console.log(`[AdminMiddleware] Checking admin session for: ${c.req.url}`);
    const session = await auth.api.getSession({
        headers: c.req.raw.headers,
    });

    if (!session || !session.user || session.user.role !== "admin") {
        console.warn("[AdminMiddleware] Forbidden: User is not an admin.", {
            email: session?.user?.email,
            role: session?.user?.role,
            url: c.req.url,
        });
        return c.json(apiResponse.error("Forbidden: Admin access required"), 403);
    }

    c.set("user", session.user as any);
    await next();
});
