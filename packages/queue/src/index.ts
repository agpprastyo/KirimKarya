import * as bullmq from "bullmq";
import { redis, env } from "@kirimkarya/redis";
import { propagation, context, ROOT_CONTEXT } from "@kirimkarya/observability";

const redisUrl = new URL(env.REDIS_URL || "redis://localhost:6379");
const bullConnectionOptions = {
    host: redisUrl.hostname,
    port: parseInt(redisUrl.port || "6379", 10),
    maxRetriesPerRequest: null as null,
    enableReadyCheck: false,
    connectTimeout: 5000,
};

export const PHOTO_PROCESSING_QUEUE = "photo-processing";
export const NOTIFICATION_QUEUE = "notifications";
export const DELIVERY_QUEUE = "delivery";
export const CLEANUP_QUEUE = "cleanup";

export interface TracedJobData {
    _otel_carrier?: Record<string, string>;
}

export interface PhotoProcessingJobData extends TracedJobData {
    photoId: string;
    userId: string;
    galleryId: string;
    originalS3Key: string;
}

export type NotificationType = 
    | "GALLERY_PUBLISHED"
    | "GALLERY_DELIVERY"
    | "PHOTOS_READY"
    | "CLIENT_SELECTION_SUBMITTED"
    | "CLIENT_REMINDER";

export interface BaseNotificationJobData extends TracedJobData {
    galleryId: string;
    userId: string;
}

export interface GalleryPublishedJobData extends BaseNotificationJobData {
    type: "GALLERY_PUBLISHED";
    data?: never;
}

export interface GalleryDeliveryJobData extends BaseNotificationJobData {
    type: "GALLERY_DELIVERY";
    data?: never;
}

export interface PhotosReadyJobData extends BaseNotificationJobData {
    type: "PHOTOS_READY";
    data?: never;
}

export interface ClientSelectionSubmittedJobData extends BaseNotificationJobData {
    type: "CLIENT_SELECTION_SUBMITTED";
    data: {
        selectionCount: number;
        clientEmail: string;
    };
}

export interface ClientReminderJobData extends BaseNotificationJobData {
    type: "CLIENT_REMINDER";
    data: {
        clientEmail: string;
        message: string;
    };
}

export type NotificationJobData =
    | GalleryPublishedJobData
    | GalleryDeliveryJobData
    | PhotosReadyJobData
    | ClientSelectionSubmittedJobData
    | ClientReminderJobData;

export interface CleanupJobData extends TracedJobData {}

class Queue<DataType = any, ResultType = any, NameType extends string = string> extends bullmq.Queue<DataType, ResultType, NameType> {}

class Worker<DataType = any, ResultType = any, NameType extends string = string> extends bullmq.Worker<DataType, ResultType, NameType> {}

export const photoQueue = new Queue<PhotoProcessingJobData>(PHOTO_PROCESSING_QUEUE, {
    connection: bullConnectionOptions,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 1000,
        },
        timeout: 120000,
        removeOnComplete: true,
        removeOnFail: false,
    } as any,
});

export const notificationQueue = new Queue<NotificationJobData>(NOTIFICATION_QUEUE, {
    connection: bullConnectionOptions,
    defaultJobOptions: {
        attempts: 5,
        backoff: {
            type: "exponential",
            delay: 2000,
        },
        timeout: 30000,
        removeOnComplete: true,
        removeOnFail: false,
    } as any,
});

export const cleanupQueue = new Queue<CleanupJobData>(CLEANUP_QUEUE, {
    connection: bullConnectionOptions,
    defaultJobOptions: {
        attempts: 1,
        timeout: 60000,
        removeOnComplete: true,
        removeOnFail: false,
    } as any,
});

export const deliveryQueue = new Queue<NotificationJobData>(DELIVERY_QUEUE, {
    connection: bullConnectionOptions,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 5000,
        },
        timeout: 300000,
        removeOnComplete: true,
        removeOnFail: false,
    } as any,
});

// Eager connection test — verify BullMQ can connect at startup
photoQueue.waitUntilReady()
    .then(() => console.log("[Queue] ✅ photoQueue connected to Redis"))
    .catch((err) => console.error("[Queue] ❌ photoQueue connection failed:", err.message));

// Redis pub/sub channel for dispatching photo jobs from API → Worker.
// BullMQ's ioredis hangs in Bun's Bun.serve() context, so the API publishes
// job data via Bun's native RedisClient, and the Worker subscribes and calls
// photoQueue.add() (which works in the Worker process).
export const PHOTO_JOB_CHANNEL = "kirimkarya:photo-job";

/**
 * Publish a photo processing job via Bun's native Redis PUBLISH.
 * Call this from the API instead of photoQueue.add().
 */
export async function publishPhotoJob(data: PhotoProcessingJobData): Promise<void> {
    await redis.publish(PHOTO_JOB_CHANNEL, JSON.stringify(data));
}

export type PhotoJob = bullmq.Job<PhotoProcessingJobData>;
export type NotificationJob = bullmq.Job<NotificationJobData>;
export { Queue, Worker };
