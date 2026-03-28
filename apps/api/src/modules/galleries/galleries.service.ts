import { db, galleries, galleryAccess, photos, feedbacks } from "@kirimkarya/db";
import { eq, and, count } from "drizzle-orm";

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
                isPrivate: data.isPrivate ?? false,
                expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
            })
            .returning();

        if (!newGallery) throw new Error("Failed to create gallery");

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
        }

        return updatedGallery ? this.getById(id, userId) : null;
    }

    async delete(id: string, userId: string) {
        const [deletedGallery] = await db
            .delete(galleries)
            .where(and(eq(galleries.id, id), eq(galleries.userId, userId)))
            .returning();
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
