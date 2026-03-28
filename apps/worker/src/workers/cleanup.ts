import { Worker } from "bullmq";
import { redis } from "@kirimkarya/redis";
import { db, galleries, photos, feedbacks, eq, lt, inArray } from "@kirimkarya/db";
import { s3 } from "@kirimkarya/storage";
import {
    CLEANUP_QUEUE,
    type CleanupJobData,
} from "@kirimkarya/queue";

export const cleanupWorker = new Worker<CleanupJobData>(
    CLEANUP_QUEUE,
    async (job) => {
        console.log(`[Cleanup ${job.id}] Checking for expired galleries...`);

        const expiredGalleries = await db
            .select()
            .from(galleries)
            .where(lt(galleries.expiresAt, new Date()));

        console.log(`[Cleanup ${job.id}] Found ${expiredGalleries.length} expired galleries.`);

        for (const gallery of expiredGalleries) {
            console.log(`[Cleanup ${job.id}] Cleaning up gallery ${gallery.id} (${gallery.title})`);

            try {
                const galleryPhotos = await db
                    .select()
                    .from(photos)
                    .where(eq(photos.galleryId, gallery.id));

                if (galleryPhotos.length > 0) {
                    for (const photo of galleryPhotos) {
                        const keysToDelete = [photo.originalS3Key];
                        if (photo.thumbnailS3Key) keysToDelete.push(photo.thumbnailS3Key);
                        if (photo.watermarkS3Key) keysToDelete.push(photo.watermarkS3Key);

                        for (const key of keysToDelete) {
                            try {
                                const fileRef = s3.file(key);
                                const exists = await fileRef.exists();
                                if (exists) {
                                    await fileRef.delete();
                                }
                            } catch (e) {
                                console.error(`[Cleanup ${job.id}] Failed to delete S3 object ${key}:`, e);
                            }
                        }
                    }

                    const photoIds = galleryPhotos.map(p => p.id);
                    await db.delete(feedbacks).where(inArray(feedbacks.photoId, photoIds));
                    await db.delete(photos).where(eq(photos.galleryId, gallery.id));
                }

                await db.delete(galleries).where(eq(galleries.id, gallery.id));
                console.log(`[Cleanup ${job.id}] Successfully deleted gallery ${gallery.id}`);
            } catch (error) {
                console.error(`[Cleanup ${job.id}] Failed to cleanup gallery ${gallery.id}:`, error);
            }
        }

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const expiredZips = await db
            .select()
            .from(galleries)
            .where(lt(galleries.deliveredAt, sevenDaysAgo));

        console.log(`[Cleanup ${job.id}] Found ${expiredZips.length} expired delivery ZIPs.`);

        for (const gallery of expiredZips) {
            if (gallery.deliveryZipKey) {
                console.log(`[Cleanup ${job.id}] Cleaning up expired ZIP for gallery ${gallery.id}`);
                try {
                    const fileRef = s3.file(gallery.deliveryZipKey);
                    if (await fileRef.exists()) {
                        await fileRef.delete();
                    }
                    await db.update(galleries)
                        .set({ deliveryZipKey: null })
                        .where(eq(galleries.id, gallery.id));
                } catch (e) {
                    console.error(`[Cleanup ${job.id}] Failed to cleanup ZIP for gallery ${gallery.id}:`, e);
                }
            }
        }
    },
    {
        connection: redis as any,
        concurrency: 1,
    }
);

cleanupWorker.on("completed", (job) => {
    console.log(`[Cleanup ${job.id}] Completed`);
});

cleanupWorker.on("failed", (job, err) => {
    console.error(`[Cleanup ${job?.id}] Failed with error: ${err.message}`);
});
