import { Queue, Worker, type Job } from "bullmq";
import { redis } from "@kirimkarya/redis";

export const PHOTO_PROCESSING_QUEUE = "photo-processing";
export const NOTIFICATION_QUEUE = "notifications";
export const DELIVERY_QUEUE = "delivery";
export const CLEANUP_QUEUE = "cleanup";

export interface PhotoProcessingJobData {
    photoId: string;
    userId: string;
    galleryId: string;
    originalS3Key: string;
}

export type NotificationType = 
    | "GALLERY_PUBLISHED"
    | "GALLERY_DELIVERY"
    | "PHOTOS_READY"
    | "CLIENT_SELECTION_SUBMITTED";

export interface NotificationJobData {
    type: NotificationType;
    galleryId: string;
    userId: string;
    data?: any;
}

export interface CleanupJobData {}

export const photoQueue = new Queue<PhotoProcessingJobData>(PHOTO_PROCESSING_QUEUE, {
    connection: redis as any,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
    },
});

export const notificationQueue = new Queue<NotificationJobData>(NOTIFICATION_QUEUE, {
    connection: redis as any,
    defaultJobOptions: {
        attempts: 5,
        backoff: {
            type: "exponential",
            delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
    },
});

export const cleanupQueue = new Queue<CleanupJobData>(CLEANUP_QUEUE, {
    connection: redis as any,
    defaultJobOptions: {
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: false,
    },
});

export const deliveryQueue = new Queue<NotificationJobData>(DELIVERY_QUEUE, {
    connection: redis as any,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
    },
});

export type PhotoJob = Job<PhotoProcessingJobData>;
export type NotificationJob = Job<NotificationJobData>;
