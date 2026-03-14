import { S3Client } from "bun";
import { env } from "./env";

export const s3 = new S3Client({
    accessKeyId: env.STORAGE_USER,
    secretAccessKey: env.STORAGE_PASSWORD,
    endpoint: env.STORAGE_ENDPOINT,
    bucket: env.STORAGE_BUCKET,
    region: env.STORAGE_REGION,
    // Bun automatically handles path-style if needed based on endpoint
});

export * from "./env";
