import { db } from "../db";
import { galleries, galleryAccess, photos, feedbacks } from "../schema";
import { eq, and, count } from "drizzle-orm";

export class GalleryRepository {
    async listByUserId(userId: string) {
        return await db
            .select()
            .from(galleries)
            .where(eq(galleries.userId, userId))
            .orderBy(galleries.createdAt);
    }

    async listByUserIdWithSelectionCount(userId: string) {
        return await db
            .select({
                id: galleries.id,
                userId: galleries.userId,
                title: galleries.title,
                clientEmail: galleries.clientEmail,
                status: galleries.status,
                accessMode: galleries.accessMode,
                isPrivate: galleries.isPrivate,
                expiresAt: galleries.expiresAt,
                deliveryZipKey: galleries.deliveryZipKey,
                deliveryStatus: galleries.deliveryStatus,
                deliveredAt: galleries.deliveredAt,
                selectionLimit: galleries.selectionLimit,
                pricePerExtraPhoto: galleries.pricePerExtraPhoto,
                createdAt: galleries.createdAt,
                updatedAt: galleries.updatedAt,
                selectionCount: count(feedbacks.id),
            })
            .from(galleries)
            .leftJoin(photos, eq(galleries.id, photos.galleryId))
            .leftJoin(feedbacks, and(eq(photos.id, feedbacks.photoId), eq(feedbacks.isSelected, true)))
            .where(eq(galleries.userId, userId))
            .groupBy(galleries.id)
            .orderBy(galleries.createdAt);
    }

    async findByIdAndUserId(id: string, userId: string) {
        const [gallery] = await db
            .select()
            .from(galleries)
            .where(and(eq(galleries.id, id), eq(galleries.userId, userId)));
        return gallery || null;
    }

    async findById(id: string) {
        const [gallery] = await db
            .select()
            .from(galleries)
            .where(eq(galleries.id, id));
        return gallery || null;
    }

    async create(userId: string, values: Omit<typeof galleries.$inferInsert, "userId">, tx: any = db) {
        const [newGallery] = await tx
            .insert(galleries)
            .values({
                ...values,
                userId,
            } as any)
            .returning();
        return newGallery;
    }

    async update(id: string, userId: string, values: Partial<typeof galleries.$inferInsert>, tx: any = db) {
        const [updated] = await tx
            .update(galleries)
            .set({
                ...values,
                updatedAt: new Date(),
            })
            .where(and(eq(galleries.id, id), eq(galleries.userId, userId)))
            .returning();
        return updated;
    }

    async delete(id: string, userId: string, tx: any = db) {
        const [deleted] = await tx
            .delete(galleries)
            .where(and(eq(galleries.id, id), eq(galleries.userId, userId)))
            .returning();
        return deleted;
    }

    async getAccessEmails(galleryId: string) {
        const access = await db
            .select({ email: galleryAccess.email })
            .from(galleryAccess)
            .where(eq(galleryAccess.galleryId, galleryId));
        return access.map(a => a.email);
    }

    async clearAccess(galleryId: string, tx: any = db) {
        await tx.delete(galleryAccess).where(eq(galleryAccess.galleryId, galleryId));
    }

    async addAccess(emails: { galleryId: string; email: string }[], tx: any = db) {
        if (emails.length > 0) {
            await tx.insert(galleryAccess).values(emails);
        }
    }
}

export const galleryRepository = new GalleryRepository();

