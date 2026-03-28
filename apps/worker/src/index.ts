import { cleanupQueue } from "@kirimkarya/queue";
import { photoProcessingWorker } from "./workers/photo-processing";
import { notificationWorker } from "./workers/notification";
import { cleanupWorker } from "./workers/cleanup";
import { deliveryWorker } from "./workers/delivery";
import { env } from "./env";

console.log("🚀 Kirim Karya Worker is starting...");

const workers = [photoProcessingWorker, notificationWorker, cleanupWorker, deliveryWorker];
console.log(`✅ Started ${workers.length} worker queues.`);

(async () => {
    await cleanupQueue.add("gallery_expiration_job", {}, {
        repeat: {
            pattern: "0 * * * *",
        },
    });
    console.log("⏰ Cleanup job scheduled (hourly)");
})();

Bun.serve({
    port: env.WORKER_PORT,
    fetch(req) {
        if (new URL(req.url).pathname === "/health") return new Response("OK");
        return new Response("Kirim Karya Worker is processing...");
    },
});
