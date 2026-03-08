import { Hono } from "hono";
import { db } from "@kirimkarya/db";
import { sql } from "drizzle-orm";
import { redis } from "@kirimkarya/redis";
import { s3, env as storageEnv, CreateBucketCommand } from "@kirimkarya/storage";
import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { apiResponse } from "../lib/response";

const health = new Hono();

health.get("/", async (c) => {
    const status: Record<string, "READY" | "ERROR"> = {
        auth: "READY",
        db: "ERROR",
        redis: "ERROR",
        s3: "ERROR",
    };

    try {

        await db.execute(sql`SELECT 1`);
        status.db = "READY";
    } catch (e) {
        console.error("Health Check - DB Error:", e);
    }

    try {

        const redisStatus = await redis.ping();
        if (redisStatus === "PONG") {
            status.redis = "READY";
        }
    } catch (e) {
        console.error("Health Check - Redis Error:", e);
    }

    try {

        await s3.send(new HeadBucketCommand({ Bucket: storageEnv.STORAGE_BUCKET }));
        status.s3 = "READY";
    } catch (e: any) {
        if (e.name === "NotFound" || e.$metadata?.httpStatusCode === 404) {
            console.log(`Health Check - Bucket "${storageEnv.STORAGE_BUCKET}" not found. Attempting to create...`);
            try {
                await s3.send(new CreateBucketCommand({ Bucket: storageEnv.STORAGE_BUCKET }));
                status.s3 = "READY";
            } catch (createErr) {
                console.error("Health Check - Failed to create bucket:", createErr);
            }
        } else {
            console.error("Health Check - S3 Error:", e);
        }
    }


    return apiResponse.success(c, status, "System status retrieved");
});

export { health };
