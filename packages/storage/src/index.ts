import { S3Client } from "bun";
import { env } from "./env";
export { env };
import CircuitBreaker from "opossum";

export const s3 = new S3Client({
    accessKeyId: env.STORAGE_USER,
    secretAccessKey: env.STORAGE_PASSWORD,
    endpoint: env.STORAGE_ENDPOINT,
    bucket: env.STORAGE_BUCKET,
    region: env.STORAGE_REGION,
});

export const s3Breaker = new CircuitBreaker(async <T>(action: () => Promise<T>): Promise<T> => {
    return await action();
}, {
    timeout: 10000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000
});

export const withS3Breaker = <T>(action: () => Promise<T>): Promise<T> => {
    return s3Breaker.fire(action) as Promise<T>;
};


