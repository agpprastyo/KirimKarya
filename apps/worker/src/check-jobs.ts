import { Queue } from "bullmq";
import { redis } from "@kirimkarya/redis";

async function check() {
    console.log("Connecting to Redis...");
    const photoQueue = new Queue("photo-processing", { connection: redis as any });
    
    const waiting = await photoQueue.getWaiting();
    const active = await photoQueue.getActive();
    const failed = await photoQueue.getFailed();
    const completed = await photoQueue.getCompleted();

    console.log(`Waiting jobs count: ${waiting.length}`);
    console.log(`Active jobs count: ${active.length}`);
    console.log(`Failed jobs count: ${failed.length}`);
    console.log(`Completed jobs count: ${completed.length}`);

    if (failed.length > 0) {
        console.log("\n--- Sample Failed Job ---");
        const sample = failed[0];
        if (sample) {
            console.log(`Job ID: ${sample.id}`);
            console.log(`Failed Reason: ${sample.failedReason}`);
            console.log(`Stacktrace:`, sample.stacktrace);
        }
    }
}

check().then(() => process.exit(0));
