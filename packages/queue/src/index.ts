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
    | "CLIENT_SELECTION_SUBMITTED"
    | "CLIENT_REMINDER";

export interface BaseNotificationJobData {
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

export interface CleanupJobData {}

export const photoQueue = new Queue<PhotoProcessingJobData>(PHOTO_PROCESSING_QUEUE, {
    connection: redis as any,
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
    connection: redis as any,
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
    connection: redis as any,
    defaultJobOptions: {
        attempts: 1,
        timeout: 60000,
        removeOnComplete: true,
        removeOnFail: false,
    } as any,
});

export const deliveryQueue = new Queue<NotificationJobData>(DELIVERY_QUEUE, {
    connection: redis as any,
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

export type PhotoJob = Job<PhotoProcessingJobData>;
export type NotificationJob = Job<NotificationJobData>;
