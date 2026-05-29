import { Worker } from "bullmq";
import { redis } from "@kirimkarya/redis";
import { db, photos, eq, count, ne, user } from "@kirimkarya/db";
import { s3 } from "@kirimkarya/storage";
import {
    PHOTO_PROCESSING_QUEUE,
    type PhotoProcessingJobData,
    notificationQueue,
} from "@kirimkarya/queue";
import sharp from "sharp";

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
                .resize(400, 400, { fit: "inside", withoutEnlargement: true })
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

            console.log(`[Job ${job.id}] Preview dimensions: ${width}x${height}`);

            // Fetch user watermark settings
            const [userData] = await db
                .select({
                    watermarkType: user.watermarkType,
                    watermarkText: user.watermarkText,
                    watermarkImageKey: user.watermarkImageKey,
                    watermarkOpacity: user.watermarkOpacity,
                })
                .from(user)
                .where(eq(user.id, userId))
                .limit(1);

            const opacity = (userData?.watermarkOpacity ?? 30) / 100;
            let svgOverlay = "";

            if (userData?.watermarkType === "IMAGE" && userData?.watermarkImageKey) {
                try {
                    const logoFile = s3.file(userData.watermarkImageKey);
                    if (await logoFile.exists()) {
                        const logoBytes = await logoFile.bytes();
                        const base64Png = Buffer.from(logoBytes).toString("base64");

                        // Beautiful repeating Shutterstock-style PNG logo grid pattern rotated -30deg
                        svgOverlay = `<svg width="${width}" height="${height}">
                            <defs>
                                <pattern id="wm-logo-grid" width="220" height="220" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
                                    <image href="data:image/png;base64,${base64Png}" x="60" y="60" width="100" height="100" opacity="${opacity}" />
                                </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill="url(#wm-logo-grid)" />
                        </svg>`;
                        console.log(`[Job ${job.id}] Applied custom image logo watermark grid.`);
                    }
                } catch (logoErr: any) {
                    console.error(`[Job ${job.id}] Failed to load custom logo. Falling back to text.`, logoErr.message);
                }
            }

            if (!svgOverlay) {
                const text = userData?.watermarkText || "Kirim Karya";
                const fontSize = Math.max(16, Math.floor(width / 24));

                // Beautiful repeating Shutterstock-style text grid pattern rotated -30deg
                svgOverlay = `<svg width="${width}" height="${height}">
                    <defs>
                        <pattern id="wm-text-grid" width="240" height="240" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
                            <text x="120" y="120" font-family="sans-serif" font-size="${fontSize}" font-weight="bold" fill="white" fill-opacity="${opacity}" text-anchor="middle">${text}</text>
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#wm-text-grid)" />
                </svg>`;
                console.log(`[Job ${job.id}] Applied text watermark grid: "${text}"`);
            }

            const watermarkBuffer = await sharp(resizedBuffer)
                .composite([
                    {
                        input: Buffer.from(svgOverlay),
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
