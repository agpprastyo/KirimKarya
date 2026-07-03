import { redis } from "@kirimkarya/redis";
import { db, galleries, photos, feedbacks, galleryAccess } from "@kirimkarya/db";
import { eq, and } from "drizzle-orm";
import { s3, env as storageEnv, withS3Breaker } from "@kirimkarya/storage";
import {
    DELIVERY_QUEUE,
    type NotificationJobData,
    Worker,
} from "@kirimkarya/queue";
import { sendGalleryDeliveredEmail } from "@kirimkarya/mail";
import { env } from "@kirimkarya/env";
import { createRequire } from "module";
import { PassThrough, Readable } from "stream";
import { S3Client as AwsS3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

const require = createRequire(import.meta.url);
const archiver = require("archiver") as any;


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

            await redis.del(`cache:gallery:${galleryId}:metadata`).catch(() => {});

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

            const archive = archiver("zip", { zlib: { level: 5 } });
            const passThrough = new PassThrough();
            archive.pipe(passThrough);

            const zipKey = `${userId}/${galleryId}/delivery/photos.zip`;

            const awsClient = new AwsS3Client({
                region: storageEnv.STORAGE_REGION,
                endpoint: storageEnv.STORAGE_ENDPOINT,
                credentials: {
                    accessKeyId: storageEnv.STORAGE_USER,
                    secretAccessKey: storageEnv.STORAGE_PASSWORD,
                },
                forcePathStyle: true,
            });

            const upload = new Upload({
                client: awsClient,
                params: {
                    Bucket: storageEnv.STORAGE_BUCKET,
                    Key: zipKey,
                    Body: passThrough,
                    ContentType: "application/zip",
                }
            });

            const uploadPromise = withS3Breaker(() => upload.done());

            for (const photo of selectedPhotos) {
                try {
                     const fileRef = s3.file(photo.originalS3Key);
                     const exists = await withS3Breaker(() => fileRef.exists());
                     if (exists) {
                         const webStream = fileRef.stream();
                         const nodeStream = Readable.fromWeb(webStream as any);
                         archive.append(nodeStream, { name: photo.filename });
                     } else {
                         console.warn(`[Delivery ${job.id}] Photo ${photo.id} not found at ${photo.originalS3Key}`);
                     }
                } catch (e: any) {
                    console.error(`[Delivery ${job.id}] Error fetching photo ${photo.id}:`, e);
                }
            }

            await archive.finalize();
            await uploadPromise;
            await db.update(galleries)
                .set({
                    deliveryStatus: "COMPLETED",
                    deliveryZipKey: zipKey,
                    deliveredAt: new Date()
                })
                .where(eq(galleries.id, galleryId));

            await redis.del(`cache:gallery:${galleryId}:metadata`).catch(() => {});

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
            
            await redis.del(`cache:gallery:${galleryId}:metadata`).catch(() => {});
            
            throw error;
        }
    },
    {
        connection: redis as any,
        concurrency: 2,
        lockDuration: 120000,
        stalledInterval: 15000,
        maxStalledCount: 2,
    }
);

deliveryWorker.on("stalled", (jobId, prev) => {
    console.warn(`[Delivery Worker] Job ${jobId} has stalled! Previous state: ${prev}`);
});
