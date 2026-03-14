import { Worker } from "bullmq";
import { redis } from "@kirimkarya/redis";
import { db, photos, eq, count, ne } from "@kirimkarya/db";
import { s3 } from "@kirimkarya/storage";
import {
    PHOTO_PROCESSING_QUEUE,
    type PhotoProcessingJobData,
    notificationQueue,
} from "@kirimkarya/queue";
import sharp from "sharp";

// Optimize Sharp performance
sharp.cache(true);
sharp.concurrency(2); 

export const photoProcessingWorker = new Worker<PhotoProcessingJobData>(
    PHOTO_PROCESSING_QUEUE,
    async (job) => {
        const { photoId, userId, galleryId, originalS3Key } = job.data;
        console.log(`[Job ${job.id}] Processing photo ${photoId} for gallery ${galleryId}`);

        try {
            const originalFile = s3.file(originalS3Key);
            const exists = await originalFile.exists();
            if (!exists) throw new Error("Original file not found in S3");

            const bytes = await originalFile.bytes();
            const buffer = Buffer.from(bytes);

            const thumbnailBuffer = await sharp(buffer)
                .resize(400, 400, { fit: "cover" })
                .toBuffer();

            const thumbnailKey = `${userId}/${galleryId}/thumbs/${photoId}.webp`;
            await s3.file(thumbnailKey).write(thumbnailBuffer, {
                type: "image/webp",
            });

            const resizedBuffer = await sharp(buffer)
                .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
                .toBuffer();

            const metadata = await sharp(resizedBuffer).metadata();
            const width = Math.floor(metadata.width || 1200);
            const height = Math.floor(metadata.height || 1200);
            const fontSize = Math.max(24, Math.floor(width / 15));

            console.log(`[Job ${job.id}] Preview dimensions: ${width}x${height}`);

            const watermarkBuffer = await sharp(resizedBuffer)
                .composite([
                    {
                        input: Buffer.from(
                            `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
                                <text x="50%" y="50%" font-family="Arial" font-size="${fontSize}" font-weight="bold" fill="white" fill-opacity="0.3" text-anchor="middle">Kirim Karya</text>
                            </svg>`
                        ),
                        gravity: "center",
                    },
                ])
                .toBuffer();

            const watermarkKey = `${userId}/${galleryId}/previews/${photoId}.webp`;
            await s3.file(watermarkKey).write(watermarkBuffer, {
                type: "image/webp",
            });

            await db.update(photos).set({
                thumbnailS3Key: thumbnailKey,
                watermarkS3Key: watermarkKey,
                status: "READY",
            }).where(eq(photos.id, photoId));

            const [counts] = await db
                .select({
                    total: count(),
                    pending: count(ne(photos.status, "READY")),
                })
                .from(photos)
                .where(eq(photos.galleryId, galleryId));

            if (counts && counts.pending === 0) {
                console.log(`[Job ${job.id}] All photos in gallery ${galleryId} are READY. Queueing notification.`);
                await notificationQueue.add(`photos_ready_${galleryId}`, {
                    type: "PHOTOS_READY",
                    galleryId,
                    userId,
                });
            }

            console.log(`[Job ${job.id}] Done! Photo ${photoId} is READY.`);
        } catch (error: any) {
            console.error(`[Job ${job.id}] Failed:`, error.message);
            await db.update(photos).set({ status: "ERROR" }).where(eq(photos.id, photoId));
            throw error;
        }
    },
    {
        connection: redis as any,
        concurrency: 4,
    }
);

photoProcessingWorker.on("completed", (job) => {
    console.log(`[Job ${job.id}] Completed successfully.`);
});

photoProcessingWorker.on("failed", (job, err) => {
    console.error(`[Job ${job?.id}] Failed with error: ${err.message}`);
});
