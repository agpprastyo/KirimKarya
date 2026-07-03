import { createMiddleware } from "hono/factory";
import { trace, propagation, ROOT_CONTEXT, context } from "@kirimkarya/observability";

const tracer = trace.getTracer("kirimkarya-api");

export const tracingMiddleware = () => {
    return createMiddleware(async (c, next) => {
        // Extract parent context from incoming HTTP headers
        const parentContext = propagation.extract(ROOT_CONTEXT, c.req.raw.headers);

        const spanName = `${c.req.method} ${c.req.path}`;
        const span = tracer.startSpan(spanName, {
            attributes: {
                "http.method": c.req.method,
                "http.target": c.req.path,
                "http.host": c.req.header("host") || "",
                "http.user_agent": c.req.header("user-agent") || "",
            },
        }, parentContext);

        // Run next middlewares in the context of this span
        return await context.with(trace.setSpan(parentContext, span), async () => {
            try {
                await next();
            } finally {
                span.setAttribute("http.status_code", c.res.status);
                span.end();
            }
        });
    });
};
