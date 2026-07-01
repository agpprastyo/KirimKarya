import { RedisClient } from "bun";
import { env } from "@kirimkarya/env";

export const redis = new RedisClient(env.REDIS_URL, {
    maxRetries: 3,
});

export { env };
