import { db, galleries, photos, feedbacks, galleryRepository, photoRepository } from "@kirimkarya/db";
import { eq, and, count, inArray } from "drizzle-orm";
import { s3, withS3Breaker } from "@kirimkarya/storage";
import { redis } from "@kirimkarya/redis";
import { CreateGallerySchema, UpdateGallerySchema } from "./galleries.schema";
import { z } from "zod";

export class GalleryService {
    async listByUserId(userId: string) {
        const list = await galleryRepository.listByUserIdWithSelectionCount(userId);
        return list.map(g => ({
            ...g,
            selectionCount: Number(g.selectionCount)
        }));
    }

    async getById(id: string, userId: string) {
        const gallery = await galleryRepository.findByIdAndUserId(id, userId);
        if (!gallery) return null;

        const allowedEmails = await galleryRepository.getAccessEmails(id);
        const selectionCount = await this.countSelectedPhotos(id);

        return {
            ...gallery,
            id: gallery.id,
            title: gallery.title,
            status: gallery.status,
            accessMode: gallery.accessMode,
            allowedEmails,
            selectionCount
        };
    }

    async create(userId: string, data: z.infer<typeof CreateGallerySchema>) {
        let passwordHash = undefined;
        if (data.password) {
            passwordHash = await Bun.password.hash(data.password, {
                algorithm: "bcrypt",
                cost: 10,
            });
        }

        return await db.transaction(async (tx) => {
            const newGallery = await galleryRepository.create(userId, {
                title: data.title,
                clientEmail: data.clientEmail || null,
                passwordHash: passwordHash || null,
                isPrivate: true,
                expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
            }, tx);

            if (!newGallery) throw new Error("Failed to create gallery");

            if (data.clientEmail) {
                const emails = data.clientEmail
                    .split(/[,\s]+/)
                    .filter((e: string) => e.includes("@"));

                if (emails.length > 0) {
                    await galleryRepository.addAccess(
                        emails.map((email: string) => ({
                            galleryId: newGallery.id,
                            email,
                        })),
                        tx
                    );
                }
            }

            return {
                ...newGallery,
                id: newGallery.id as string,
                title: newGallery.title as string,
                status: newGallery.status as "DRAFT" | "PUBLISHED" | "ARCHIVED",
                accessMode: newGallery.accessMode as "OTP" | "PASSWORD",
                selectionCount: 0
            };
        });
    }

    async update(
        id: string,
        userId: string,
        data: Partial<z.infer<typeof UpdateGallerySchema>> & {
            deliveryStatus?: "IDLE" | "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
        }
    ) {
        const { allowedEmails, password, ...updateData } = data;

        let passwordHash = undefined;
        if (password) {
            passwordHash = await Bun.password.hash(password, {
                algorithm: "bcrypt",
                cost: 10,
            });
        }

        const expiresAtParsed = updateData.expiresAt ? new Date(updateData.expiresAt) : undefined;

        await db.transaction(async (tx) => {
            const updatedGallery = await galleryRepository.update(id, userId, {
                ...updateData,
                passwordHash: passwordHash !== undefined ? passwordHash : undefined,
                expiresAt: expiresAtParsed !== undefined ? expiresAtParsed : undefined,
            } as any, tx);

            if (updatedGallery) {
                const emailsFromClientAttr = updatedGallery.clientEmail
                    ? updatedGallery.clientEmail.split(/[,\s]+/).filter((e: string) => e.includes("@"))
                    : [];

                const combinedEmails = Array.from(new Set([
                    ...emailsFromClientAttr,
                    ...(allowedEmails || [])
                ]));

                await galleryRepository.clearAccess(id, tx);
                if (combinedEmails.length > 0) {
                    await galleryRepository.addAccess(
                        combinedEmails.map((email: string) => ({
                            galleryId: id,
                            email,
                        })),
                        tx
                    );
                }
            }
        });

        await redis.del(`cache:gallery:${id}:metadata`);
        await redis.del(`cache:gallery:${id}:photos`);

        return this.getById(id, userId);
    }

    async delete(id: string, userId: string) {
        // 1. Get all photos belonging to the gallery to drop S3 assets asynchronously later
        const targetPhotos = await photoRepository.listByGalleryId(id);

        // 2. Cascade delete records in DB synchronously wrapped in transaction
        const deletedGallery = await db.transaction(async (tx) => {
            const photoIds = targetPhotos.map((p) => p.id);
            if (photoIds.length > 0) {
                await tx.delete(feedbacks).where(inArray(feedbacks.photoId, photoIds));
                await tx.delete(photos).where(inArray(photos.id, photoIds));
            }
            await galleryRepository.clearAccess(id, tx);
            return await galleryRepository.delete(id, userId, tx);
        });

        // 3. Fire S3 deletion in the background asynchronously (non-blocking)
        if (targetPhotos.length > 0) {
            Promise.all(
                targetPhotos.flatMap((p) => {
                    const keys = [];
                    if (p.originalS3Key) keys.push(p.originalS3Key);
                    if (p.thumbnailS3Key) keys.push(p.thumbnailS3Key);
                    if (p.watermarkS3Key) keys.push(p.watermarkS3Key);
                    return keys.map((key) => withS3Breaker(() => s3.file(key).delete()).catch(() => {}));
                })
            ).catch((err) => {
                console.error("Failed to async delete gallery S3 files:", err);
            });
        }
        await redis.del(`cache:gallery:${id}:metadata`);
        await redis.del(`cache:gallery:${id}:photos`);

        return deletedGallery;
    }

    async countSelectedPhotos(galleryId: string) {
        const [result] = await db
            .select({ count: count() })
            .from(photos)
            .innerJoin(feedbacks, eq(photos.id, feedbacks.photoId))
            .where(and(
                eq(photos.galleryId, galleryId),
                eq(feedbacks.isSelected, true)
            ));

        return Number(result?.count || 0);
    }
}

export const galleryService = new GalleryService();


