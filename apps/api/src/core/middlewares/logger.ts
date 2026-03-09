import type { Context, Next } from "hono";

export const loggerMiddleware = () => async (c: Context, next: Next) => {
    const start = Date.now();
    const { method, url } = c.req;

    await next();

    const end = Date.now();
    const duration = end - start;
    const { status } = c.res;

    console.log(
        `[${new Date().toISOString()}] ${method} ${url} - ${status} - ${duration}ms`
    );
};
