import { PHOTO_JOB_CHANNEL, cleanupQueue, photoQueue, type PhotoProcessingJobData } from "@kirimkarya/queue";
import { photoProcessingWorker } from "./workers/photo-processing";
import { notificationWorker } from "./workers/notification";
import { cleanupWorker } from "./workers/cleanup";
import { deliveryWorker } from "./workers/delivery";
import { env } from "@kirimkarya/env";
import { RedisClient } from "bun";

console.log("🚀 Kirim Karya Worker is starting...");

const workers = [photoProcessingWorker, notificationWorker, cleanupWorker, deliveryWorker];
console.log(`✅ Started ${workers.length} worker queues.`);

const photoJobSubscriber = new RedisClient(env.REDIS_URL);

const enqueuePhotoJobFromMessage = async (message: string) => {
    let payload: Partial<PhotoProcessingJobData>;

    try {
        payload = JSON.parse(message) as Partial<PhotoProcessingJobData>;
    } catch (err: any) {
        console.error(`[Queue Bridge] Invalid photo job payload (not JSON): ${err?.message || err}`);
        return;
    }

    const { photoId, userId, galleryId, originalS3Key } = payload;
    if (!photoId || !userId || !galleryId || !originalS3Key) {
        console.error("[Queue Bridge] Incomplete photo job payload received:", payload);
        return;
    }

    await photoQueue.add(
        "process-photo",
        {
            photoId,
            userId,
            galleryId,
            originalS3Key,
        },
        {
            jobId: photoId,
        }
    );

    console.log(`[Queue Bridge] Enqueued photo job ${photoId} from ${PHOTO_JOB_CHANNEL}`);
};

await photoJobSubscriber.connect();
await photoJobSubscriber.subscribe(PHOTO_JOB_CHANNEL, (message) => {
    void enqueuePhotoJobFromMessage(message).catch((err: any) => {
        console.error(`[Queue Bridge] Failed to enqueue photo job from ${PHOTO_JOB_CHANNEL}:`, err?.message || err);
    });
});
console.log(`✅ Subscribed to ${PHOTO_JOB_CHANNEL}`);

(async () => {
    await cleanupQueue.add("gallery_expiration_job", {}, {
        repeat: {
            pattern: "0 * * * *",
        },
    });
    console.log("⏰ Cleanup job scheduled (hourly)");
})();

const server = Bun.serve({
    port: env.WORKER_PORT,
    fetch(req) {
        if (new URL(req.url).pathname === "/health") return new Response("OK");
        return new Response("Kirim Karya Worker is processing...");
    },
});

const shutdown = async (signal: string) => {
    console.log(`\n[Worker] Received ${signal}. Starting graceful shutdown...`);

    // Set a safety fallback exit timeout of 10 seconds
    const timeout = setTimeout(() => {
        console.error("[Worker] Graceful shutdown timed out. Forcing exit.");
        process.exit(1);
    }, 10000);

    try {
        console.log("[Worker] Stopping HTTP health listener...");
        server.stop(true);
        console.log("[Worker] HTTP health listener stopped.");
    } catch (err: any) {
        console.error("[Worker] Failed to stop HTTP health listener:", err.message);
    }

    try {
        console.log("[Worker] Closing photo job subscriber...");
        photoJobSubscriber.close();
        console.log("[Worker] Photo job subscriber closed.");
    } catch (err: any) {
        console.error("[Worker] Failed to close photo job subscriber:", err.message);
    }

    await Promise.all(
        workers.map(async (worker) => {
            console.log(`[Worker] Closing worker: ${worker.name}...`);
            try {
                await worker.close();
                console.log(`[Worker] Closed worker: ${worker.name}`);
            } catch (err: any) {
                console.error(`[Worker] Failed to close worker ${worker.name}:`, err.message);
            }
        })
    );

    try {
        const { pgClient } = await import("@kirimkarya/db");
        console.log("[Worker] Closing database connection pool...");
        await pgClient.end();
        console.log("[Worker] Database connection pool closed gracefully.");
    } catch (err: any) {
        console.error("[Worker] Failed to close database connection pool:", err.message);
    }

    clearTimeout(timeout);
    console.log("[Worker] All workers and pools closed gracefully. Exiting process.");
    process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
