import { S3Client, CreateBucketCommand } from "@aws-sdk/client-s3";
export { CreateBucketCommand };
import { env } from "./env";

export const s3 = new S3Client({
    endpoint: env.STORAGE_ENDPOINT,
    region: env.STORAGE_REGION,
    credentials: {
        accessKeyId: env.STORAGE_USER,
        secretAccessKey: env.STORAGE_PASSWORD,
    },
    forcePathStyle: true,
});

export * from "./env";
