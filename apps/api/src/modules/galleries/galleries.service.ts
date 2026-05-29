import { db, galleries, galleryAccess, photos, feedbacks } from "@kirimkarya/db";
import { eq, and, count, inArray } from "drizzle-orm";
import { s3, withS3Breaker } from "@kirimkarya/storage";
import { redis } from "@kirimkarya/redis";

export class GalleryService {
    async listByUserId(userId: string) {
        const list = await db
            .select()
            .from(galleries)
            .where(eq(galleries.userId, userId))
            .orderBy(galleries.createdAt);

        const enhancedList = await Promise.all(list.map(async (gallery) => {
            const selectionCount = await this.countSelectedPhotos(gallery.id);
            return {
                ...gallery,
                id: gallery.id,
                title: gallery.title,
                status: gallery.status,
                accessMode: gallery.accessMode,
                selectionCount
            };
        }));

        return enhancedList;
    }

    async getById(id: string, userId: string) {
        const [gallery] = await db
            .select()
            .from(galleries)
            .where(and(eq(galleries.id, id), eq(galleries.userId, userId)));

        if (!gallery) return null;

        const allowedEmails = await db
            .select({ email: galleryAccess.email })
            .from(galleryAccess)
            .where(eq(galleryAccess.galleryId, id));

        const selectionCount = await this.countSelectedPhotos(id);

        return {
            ...gallery,
            id: gallery.id,
            title: gallery.title,
            status: gallery.status,
            accessMode: gallery.accessMode,
            allowedEmails: allowedEmails.map((ae: { email: string }) => ae.email),
            selectionCount
        };
    }

    async create(userId: string, data: any) {
        let passwordHash = undefined;
        if (data.password) {
            passwordHash = await Bun.password.hash(data.password, {
                algorithm: "bcrypt",
                cost: 10,
            });
        }

        const [newGallery] = await db
            .insert(galleries)
            .values({
                userId,
                title: data.title,
                clientEmail: data.clientEmail,
                passwordHash,
                isPrivate: data.isPrivate ?? true,
                expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
            })
            .returning();

        if (!newGallery) throw new Error("Failed to create gallery");

        if (data.clientEmail) {
            const emails = data.clientEmail
                .split(/[,\s]+/)
                .filter((e: string) => e.includes("@"));

            if (emails.length > 0) {
                await db.insert(galleryAccess).values(
                    emails.map((email: string) => ({
                        galleryId: newGallery.id,
                        email,
                    }))
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
    }

    async update(id: string, userId: string, data: any) {
        const { allowedEmails, password, ...updateData } = data;

        if (password) {
            updateData.passwordHash = await Bun.password.hash(password, {
                algorithm: "bcrypt",
                cost: 10,
            });
        }

        if (updateData.expiresAt) {
            updateData.expiresAt = new Date(updateData.expiresAt);
        }

        const [updatedGallery] = await db
            .update(galleries)
            .set({
                ...updateData,
                updatedAt: new Date(),
            })
            .where(and(eq(galleries.id, id), eq(galleries.userId, userId)))
            .returning();

        if (updatedGallery) {
            const emailsFromClientAttr = updatedGallery.clientEmail
                ? updatedGallery.clientEmail.split(/[,\s]+/).filter((e: string) => e.includes("@"))
                : [];

            const combinedEmails = Array.from(new Set([
                ...emailsFromClientAttr,
                ...(allowedEmails || [])
            ]));

            await db.delete(galleryAccess).where(eq(galleryAccess.galleryId, id));
            if (combinedEmails.length > 0) {
                await db.insert(galleryAccess).values(
                    combinedEmails.map((email: string) => ({
                        galleryId: id,
                        email,
                    }))
                );
            }
            await redis.del(`cache:gallery:${id}:metadata`);
        }

        return updatedGallery ? this.getById(id, userId) : null;
    }

    async delete(id: string, userId: string) {
        // 1. Get all photos belonging to the gallery to drop S3 assets asynchronously later
        const targetPhotos = await db
            .select()
            .from(photos)
            .where(eq(photos.galleryId, id));

        // 2. Cascade delete records in DB synchronously (in relational dependency order)
        const photoIds = targetPhotos.map((p) => p.id);
        if (photoIds.length > 0) {
            await db.delete(feedbacks).where(inArray(feedbacks.photoId, photoIds));
            await db.delete(photos).where(inArray(photos.id, photoIds));
        }

        await db.delete(galleryAccess).where(eq(galleryAccess.galleryId, id));

        const [deletedGallery] = await db
            .delete(galleries)
            .where(and(eq(galleries.id, id), eq(galleries.userId, userId)))
            .returning();

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
