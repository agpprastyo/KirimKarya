import { notificationQueue } from "../packages/queue/src";
import { redis } from "../packages/redis/src";

async function testNotifications() {
    console.log("Adding test notification jobs...");

    const galleryId = "018e2a3b-4c5d-7e8f-9a0b-1c2d3e4f5a6b";
    const userId = "test-user-id";

    await notificationQueue.add("test_published", {
        type: "GALLERY_PUBLISHED",
        galleryId,
        userId,
    });

    await notificationQueue.add("test_ready", {
        type: "PHOTOS_READY",
        galleryId,
        userId,
    });

    await notificationQueue.add("test_submitted", {
        type: "CLIENT_SELECTION_SUBMITTED",
        galleryId,
        userId,
        data: { selectionCount: 5 },
    });

    console.log("Jobs added! Check worker logs.");
    await redis.close();
    process.exit(0);
}

testNotifications().catch(console.error);
