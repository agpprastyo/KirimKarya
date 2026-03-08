import Redis from "ioredis";
import { env } from "./env";

export const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    retryStrategy: (times: number) => {
        // Return null to stop retrying indefinitely
        if (times > 3) return null;
        return Math.min(times * 50, 2000);
    },
});

export * from "./env";
