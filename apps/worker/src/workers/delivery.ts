import { Worker } from "bullmq";
import { redis } from "@kirimkarya/redis";
import { db, galleries, photos, feedbacks, galleryAccess, eq, and } from "@kirimkarya/db";
import { s3 } from "@kirimkarya/storage";
import {
    DELIVERY_QUEUE,
    type NotificationJobData,
} from "@kirimkarya/queue";
import { sendGalleryDeliveredEmail } from "@kirimkarya/mail";
import { env } from "../env";
import JSZip from "jszip";

export const deliveryWorker = new Worker<NotificationJobData>(
    DELIVERY_QUEUE,
    async (job) => {
        const { type, galleryId, userId } = job.data;
        if (type !== "GALLERY_DELIVERY") return;

        console.log(`[Delivery ${job.id}] Starting delivery for gallery ${galleryId}`);

        try {
            await db.update(galleries)
                .set({ deliveryStatus: "PROCESSING" })
                .where(eq(galleries.id, galleryId));

            const [gallery] = await db.select().from(galleries).where(eq(galleries.id, galleryId));
            if (!gallery) throw new Error("Gallery not found");

            const selectedPhotos = await db
                .select({
                    id: photos.id,
                    filename: photos.filename,
                    originalS3Key: photos.originalS3Key,
                })
                .from(photos)
                .innerJoin(feedbacks, eq(photos.id, feedbacks.photoId))
                .where(and(
                    eq(photos.galleryId, galleryId),
                    eq(feedbacks.isSelected, true)
                ));

            if (selectedPhotos.length === 0) {
                throw new Error("No photos selected for delivery");
            }

            console.log(`[Delivery ${job.id}] Packaging ${selectedPhotos.length} photos...`);

            const zip = new JSZip();

            for (const photo of selectedPhotos) {
                try {
                    const fileRef = s3.file(photo.originalS3Key);
                    const exists = await fileRef.exists();
                    if (exists) {
                        const content = await fileRef.bytes();
                        zip.file(photo.filename, content);
                    } else {
                        console.warn(`[Delivery ${job.id}] Photo ${photo.id} not found at ${photo.originalS3Key}`);
                    }
                } catch (e) {
                    console.error(`[Delivery ${job.id}] Error fetching photo ${photo.id}:`, e);
                }
            }

            const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
            const zipKey = `${userId}/${galleryId}/delivery/photos.zip`;

            await s3.file(zipKey).write(zipBuffer, {
                type: "application/zip",
            });
            await db.update(galleries)
                .set({
                    deliveryStatus: "COMPLETED",
                    deliveryZipKey: zipKey,
                    deliveredAt: new Date()
                })
                .where(eq(galleries.id, galleryId));

            const accessList = await db
                .select()
                .from(galleryAccess)
                .where(eq(galleryAccess.galleryId, galleryId));

            const downloadUrl = `${env.WEB_URL}/g/${galleryId}/download`;

            const emailPromises = accessList.map(access =>
                sendGalleryDeliveredEmail(access.email, gallery.title, downloadUrl)
            );

            await Promise.all(emailPromises);

            console.log(`[Delivery ${job.id}] Done! ZIP uploaded to ${zipKey}`);
        } catch (error: any) {
            console.error(`[Delivery ${job.id}] Failed:`, error.message);
            await db.update(galleries)
                .set({ deliveryStatus: "FAILED" })
                .where(eq(galleries.id, galleryId));
            throw error;
        }
    },
    {
        connection: redis as any,
        concurrency: 2,
    }
);
