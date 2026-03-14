import { cleanupQueue } from "@kirimkarya/queue";
import { photoProcessingWorker } from "./workers/photo-processing";
import { notificationWorker } from "./workers/notification";
import { cleanupWorker } from "./workers/cleanup";
import { env } from "./env";

console.log("🚀 Kirim Karya Worker is starting...");

// Ensure workers are referenced so they start listening
const workers = [photoProcessingWorker, notificationWorker, cleanupWorker];
console.log(`✅ Started ${workers.length} worker queues.`);

(async () => {
    // Every 1 hour
    await cleanupQueue.add("gallery_expiration_job", {}, {
        repeat: {
            pattern: "0 * * * *",
        },
    });
    console.log("⏰ Cleanup job scheduled (hourly)");
})();

// Health Check Server
Bun.serve({
    port: env.WORKER_PORT,
    fetch(req) {
        if (new URL(req.url).pathname === "/health") return new Response("OK");
        return new Response("Kirim Karya Worker is processing...");
    },
});
