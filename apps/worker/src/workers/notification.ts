import { Worker } from "bullmq";
import { redis } from "@kirimkarya/redis";
import { db, galleries, user, eq } from "@kirimkarya/db";
import {
    NOTIFICATION_QUEUE,
    type NotificationJobData,
} from "@kirimkarya/queue";
import { sendGalleryPublishedEmail, sendPhotosReadyEmail, sendSelectionSubmittedEmail } from "@kirimkarya/mail";
import { env } from "../env";

export const notificationWorker = new Worker<NotificationJobData>(
    NOTIFICATION_QUEUE,
    async (job) => {
        const { type, galleryId, userId, data } = job.data;
        console.log(`[Notification ${job.id}] Processing ${type} for gallery ${galleryId}`);

        const [gallery] = await db.select().from(galleries).where(eq(galleries.id, galleryId));
        if (!gallery) throw new Error("Gallery not found");

        const [userRecord] = await db.select().from(user).where(eq(user.id, userId));
        if (!userRecord) throw new Error("User not found");

        switch (type) {
            case "GALLERY_PUBLISHED":
                if (gallery.clientEmail) {
                    const galleryUrl = `${env.WEB_URL}/g/${galleryId}`;
                    await sendGalleryPublishedEmail(gallery.clientEmail, gallery.title, galleryUrl);
                }
                break;
            case "PHOTOS_READY":
                const dashboardUrl = `${env.WEB_URL}/dashboard/galleries/${galleryId}`;
                await sendPhotosReadyEmail(userRecord.email, gallery.title, dashboardUrl);
                break;
            case "CLIENT_SELECTION_SUBMITTED":
                const selDashboardUrl = `${env.WEB_URL}/dashboard/galleries/${galleryId}/proofing`;
                await sendSelectionSubmittedEmail(userRecord.email, gallery.title, data.selectionCount, selDashboardUrl);
                break;
        }
    },
    {
        connection: redis as any,
        concurrency: 5,
    }
);

notificationWorker.on("completed", (job) => {
    console.log(`[Notification ${job.id}] Completed successfully.`);
});

notificationWorker.on("failed", (job, err) => {
    console.error(`[Notification ${job?.id}] Failed with error: ${err.message}`);
});
