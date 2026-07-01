import type { Context, Next } from "hono";
import { logger } from "../logger";

export const loggerMiddleware = () => async (c: Context, next: Next) => {
    const start = Date.now();
    const { method, url } = c.req;
    const requestId = c.get("requestId") || c.res.headers.get("x-request-id") || undefined;
    const user = c.get("user") as any;
    const userId = user?.id;

    logger.info(`Incoming request: ${method} ${url}`, {
        requestId,
        userId,
        method,
        url,
    });

    await next();

    const end = Date.now();
    const duration = end - start;
    const { status } = c.res;

    const context = {
        requestId,
        userId,
        method,
        url,
        status,
        durationMs: duration,
    };

    if (status >= 500) {
        logger.error(`Request failed: ${method} ${url} - ${status}`, context);
    } else if (status >= 400) {
        logger.warn(`Request client error: ${method} ${url} - ${status}`, context);
    } else {
        logger.info(`Request completed: ${method} ${url} - ${status} (${duration}ms)`, context);
    }
};
