import { Queue as BullQueue, Worker as BullWorker, type Job, type JobsOptions, type Processor, type WorkerOptions } from "bullmq";
import { redis } from "@kirimkarya/redis";
import { propagation, context, ROOT_CONTEXT } from "@kirimkarya/observability";

export const PHOTO_PROCESSING_QUEUE = "photo-processing";
export const NOTIFICATION_QUEUE = "notifications";
export const DELIVERY_QUEUE = "delivery";
export const CLEANUP_QUEUE = "cleanup";

// Define trace context payload fields
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

class Queue<DataType = any, ResultType = any, NameType extends string = string> extends BullQueue<any, any, any> {
    override async add(
        name: NameType,
        data: DataType,
        opts?: JobsOptions,
    ): Promise<any> {
        const carrier: Record<string, string> = {};
        propagation.inject(context.active(), carrier);
        const tracingData = {
            ...(data as any),
            _otel_carrier: carrier,
        };
        return super.add(name, tracingData, opts);
    }

    override async addBulk(
        jobs: { name: NameType; data: DataType; opts?: JobsOptions }[],
    ): Promise<any[]> {
        const tracingJobs = jobs.map((job) => {
            const carrier: Record<string, string> = {};
            propagation.inject(context.active(), carrier);
            return {
                ...job,
                data: {
                    ...(job.data as any),
                    _otel_carrier: carrier,
                },
            };
        });
        return super.addBulk(tracingJobs);
    }
}

class Worker<DataType = any, ResultType = any, NameType extends string = string> extends BullWorker<any, any, any> {
    constructor(
        name: string,
        processor?: string | Processor<DataType, ResultType, NameType> | null,
        opts?: WorkerOptions,
    ) {
        if (typeof processor === "function") {
            const originalProcessor = processor;
            processor = async (job: Job<DataType, ResultType, NameType>, token?: string) => {
                const carrier = (job.data as any)?._otel_carrier;
                const parentContext = propagation.extract(ROOT_CONTEXT, carrier || {});
                return context.with(parentContext, () => originalProcessor(job, token));
            };
        }
        super(name, processor, opts);
    }
}

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
export { Queue, Worker };


