import { redis } from "@kirimkarya/redis";
import { db, galleries, user, galleryAccess } from "@kirimkarya/db";
import { eq } from "drizzle-orm";
import {
    NOTIFICATION_QUEUE,
    type NotificationJobData,
    Worker,
} from "@kirimkarya/queue";
import { sendGalleryPublishedEmail, sendPhotosReadyEmail, sendSelectionSubmittedEmail, sendReminderEmail } from "@kirimkarya/mail";
import { env } from "@kirimkarya/env";

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
                const accessList = await db
                    .select()
                    .from(galleryAccess)
                    .where(eq(galleryAccess.galleryId, galleryId));

                const galleryUrl = `${env.WEB_URL}/g/${galleryId}`;

                const emailPromises = accessList.map(access =>
                    sendGalleryPublishedEmail(access.email, gallery.title, galleryUrl)
                );

                await Promise.all(emailPromises);
                break;
            case "PHOTOS_READY":
                const dashboardUrl = `${env.WEB_URL}/dashboard/galleries/${galleryId}`;
                await sendPhotosReadyEmail(userRecord.email, gallery.title, dashboardUrl);
                break;
            case "CLIENT_SELECTION_SUBMITTED":
                const selDashboardUrl = `${env.WEB_URL}/dashboard/galleries/${galleryId}/proofing`;
                await sendSelectionSubmittedEmail(userRecord.email, gallery.title, data.selectionCount, selDashboardUrl);
                break;
            case "CLIENT_REMINDER":
                const reminderGalleryUrl = `${env.WEB_URL}/g/${galleryId}`;
                await sendReminderEmail(data.clientEmail, gallery.title, data.message, reminderGalleryUrl);
                break;
        }
    },
    {
        connection: redis as any,
        concurrency: 5,
        stalledInterval: 15000,
        maxStalledCount: 2,
    }
);

notificationWorker.on("stalled", (jobId, prev) => {
    console.warn(`[Notification Worker] Job ${jobId} has stalled! Previous state: ${prev}`);
});

notificationWorker.on("completed", (job) => {
    console.log(`[Notification ${job.id}] Completed successfully.`);
});

notificationWorker.on("failed", (job, err) => {
    console.error(`[Notification ${job?.id}] Failed with error: ${err.message}`);
});
