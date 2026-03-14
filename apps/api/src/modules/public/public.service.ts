import { db, galleries, photos, feedbacks, eq, and, sql } from "@kirimkarya/db";

export class PublicService {
    async getGalleryMetadata(id: string) {
        const [gallery] = await db
            .select({
                id: galleries.id,
                title: galleries.title,
                clientEmail: galleries.clientEmail,
                status: galleries.status,
                userId: galleries.userId,
                createdAt: galleries.createdAt,
            })
            .from(galleries)
            .where(eq(galleries.id, id));

        if (gallery && gallery.status === "PUBLISHED") {
            db.execute(sql`UPDATE galleries SET views = views + 1 WHERE id = ${id}`).catch(err => {
                console.error("Failed to increment gallery views:", err);
            });
        }

        return gallery;
    }

    async getGalleryPhotos(galleryId: string) {
        return await db
            .select({
                id: photos.id,
                thumbnailS3Key: photos.thumbnailS3Key,
                watermarkS3Key: photos.watermarkS3Key,
            })
            .from(photos)
            .where(and(eq(photos.galleryId, galleryId), eq(photos.status, 'READY')))
            .orderBy(photos.uploadedAt);
    }

    async toggleFeedback(photoId: string, clientIdentifier: string, isSelected?: boolean, comment?: string) {
        // Security Check: Ensure photo belongs to a PUBLISHED gallery
        const [photo] = await db
            .select({ id: photos.id })
            .from(photos)
            .innerJoin(galleries, eq(photos.galleryId, galleries.id))
            .where(and(eq(photos.id, photoId), eq(galleries.status, 'PUBLISHED')));

        if (!photo) return null;

        // Find existing feedback for this client if any
        const [existing] = await db
            .select()
            .from(feedbacks)
            .where(and(eq(feedbacks.photoId, photoId), eq(feedbacks.clientIdentifier, clientIdentifier)));

        if (existing) {
            const updateData: any = { updatedAt: new Date() };
            if (isSelected !== undefined) updateData.isSelected = isSelected;
            if (comment !== undefined) updateData.comment = comment;

            const [updated] = await db
                .update(feedbacks)
                .set(updateData)
                .where(eq(feedbacks.id, existing.id))
                .returning();
            return updated;
        } else {
            const [created] = await db
                .insert(feedbacks)
                .values({
                    photoId,
                    clientIdentifier,
                    isSelected: isSelected ?? false,
                    comment: comment ?? null,
                })
                .returning();
            return created;
        }
    }

    async getClientFeedbacks(galleryId: string, clientIdentifier: string) {
        return await db
            .select({
                photoId: feedbacks.photoId,
                isSelected: feedbacks.isSelected,
                comment: feedbacks.comment,
            })
            .from(feedbacks)
            .innerJoin(photos, eq(feedbacks.photoId, photos.id))
            .where(and(eq(photos.galleryId, galleryId), eq(feedbacks.clientIdentifier, clientIdentifier)));
    }
}

export const publicService = new PublicService();
