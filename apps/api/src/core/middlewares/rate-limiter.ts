import { createMiddleware } from "hono/factory";
import { redis } from "@kirimkarya/redis";
import { env } from "@kirimkarya/env";
import { auth } from "../../modules/auth/auth.config";
import { apiResponse } from "../../lib/response";

/**
 * Global rate-limiting middleware backed by Redis.
 * Seamlessly tracks unauthenticated clients by IP and authenticated users by User ID,
 * appending standard rate-limit headers to all responses.
 */
export const rateLimiterMiddleware = () => {
    return createMiddleware(async (c, next) => {
        // Skip rate-limiting for documentation pages
        if (c.req.path.startsWith("/api/docs")) {
            return await next();
        }

        // 1. Resolve client IP address
        const ip =
            c.req.header("cf-connecting-ip") ||
            (c.req.header("x-forwarded-for") || "").split(",")[0]?.trim() ||
            c.req.header("x-real-ip") ||
            "127.0.0.1";

        // 2. Resolve session optionally to track by user ID
        let userId: string | null = null;
        try {
            const session = await auth.api.getSession({
                headers: c.req.raw.headers,
            });
            if (session?.user?.id) {
                userId = session.user.id;
            }
        } catch {
            // Ignore session parsing errors gracefully
        }

        // 3. Determine thresholds
        const isUser = !!userId;
        const keyIdentifier = isUser ? `user:${userId}` : `ip:${ip}`;
        const limit = isUser ? env.RATE_LIMIT_USER_MAX : env.RATE_LIMIT_IP_MAX;

        const now = Math.floor(Date.now() / 1000);
        const windowTimestamp = Math.floor(now / 60) * 60;
        const redisKey = `rate_limit:${keyIdentifier}:${windowTimestamp}`;

        // 4. Perform atomic Redis increment
        const currentRequests = (await redis.incr(redisKey)) as number;
        let ttl = (await redis.ttl(redisKey)) as number;

        // If newly created key (or missing TTL), set expiration
        if (ttl === -1 || currentRequests === 1) {
            ttl = 60;
            await redis.expire(redisKey, ttl);
        }

        const remaining = Math.max(0, limit - currentRequests);
        const resetTime = windowTimestamp + 60;

        // 5. Append standard rate-limiting headers
        c.header("X-RateLimit-Limit", limit.toString());
        c.header("X-RateLimit-Remaining", remaining.toString());
        c.header("X-RateLimit-Reset", resetTime.toString());

        // 6. Threshold reached: Return 429 Too Many Requests
        if (currentRequests > limit) {
            console.warn(`[RateLimiter] Rate limit exceeded for ${keyIdentifier}: ${currentRequests}/${limit}`);
            c.header("Retry-After", (resetTime - now).toString());
            return c.json(
                apiResponse.error(
                    `Too many requests. Please try again in ${resetTime - now} seconds.`,
                    "RATE_LIMIT_EXCEEDED"
                ),
                429
            );
        }

        await next();
    });
};
