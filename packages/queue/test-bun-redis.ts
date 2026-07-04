/**
 * Test Bun RedisClient pub/sub
 */
import { redis } from "@kirimkarya/redis";

console.log("Redis Client keys:", Object.getOwnPropertyNames(Object.getPrototypeOf(redis)));
process.exit(0);
