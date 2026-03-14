import { cleanupQueue } from "../packages/queue/src";
import { redis } from "../packages/redis/src";

async function testCleanup() {
    console.log("Triggering manual cleanup job...");

    await cleanupQueue.add("manual_cleanup_" + Date.now(), {});

    console.log("Cleanup job added! Check worker logs.");
    await redis.close();
    process.exit(0);
}

testCleanup().catch(console.error);
