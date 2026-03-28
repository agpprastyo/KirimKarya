import { db, galleries, photos, feedbacks, galleryAccess, eq, and, sql } from "@kirimkarya/db";
import { redis } from "@kirimkarya/redis";
import { sendOTPEmail } from "@kirimkarya/mail";

export class PublicService {
    async getGalleryMetadata(id: string) {
        const [gallery] = await db
            .select({
                id: galleries.id,
                title: galleries.title,
                clientEmail: galleries.clientEmail,
                status: galleries.status,
                deliveryStatus: galleries.deliveryStatus,
                isPrivate: galleries.isPrivate,
                userId: galleries.userId,
                accessMode: galleries.accessMode,
                createdAt: galleries.createdAt,
                deliveredAt: galleries.deliveredAt,
                deliveryZipKey: galleries.deliveryZipKey,
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
        const [photo] = await db
            .select({ id: photos.id })
            .from(photos)
            .innerJoin(galleries, eq(photos.galleryId, galleries.id))
            .where(and(eq(photos.id, photoId), eq(galleries.status, 'PUBLISHED')));

        if (!photo) return null;

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

    async requestOTP(galleryId: string, email: string) {
        const gallery = await this.getGalleryMetadata(galleryId);
        if (!gallery || gallery.accessMode !== "OTP") {
            return { success: false, error: "OTP access not available for this gallery" };
        }

        const [access] = await db
            .select()
            .from(galleryAccess)
            .where(and(eq(galleryAccess.galleryId, galleryId), eq(galleryAccess.email, email)));

        if (!access) return { success: false, error: "Email not authorized for this gallery" };

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        const redisKey = `otp:${galleryId}:${email}`;
        await redis.set(redisKey, otp);
        await redis.expire(redisKey, 300);

        try {
            await sendOTPEmail(email, otp, gallery.title);
        } catch (error) {
            console.error("Failed to send OTP email:", error);
            return { success: false, error: "Failed to send verification email" };
        }

        return { success: true };
    }

    async verifyOTP(galleryId: string, email: string, code: string) {
        const redisKey = `otp:${galleryId}:${email}`;
        const storedOtp = await redis.get(redisKey);

        if (!storedOtp || storedOtp !== code) {
            return { success: false, error: "Invalid or expired verification code" };
        }

        await redis.del(redisKey);

        return { success: true };
    }

    async verifyStaticPassword(galleryId: string, email: string, password: string) {
        const [gallery] = await db
            .select({
                passwordHash: galleries.passwordHash,
                accessMode: galleries.accessMode
            })
            .from(galleries)
            .where(eq(galleries.id, galleryId));

        if (!gallery || gallery.accessMode !== "PASSWORD") {
            return { success: false, error: "Static password access not available for this gallery" };
        }

        const [access] = await db
            .select()
            .from(galleryAccess)
            .where(and(eq(galleryAccess.galleryId, galleryId), eq(galleryAccess.email, email)));

        if (!access) {
            return { success: false, error: "Email not authorized" };
        }

        if (!gallery.passwordHash) {
            return { success: false, error: "Gallery has no password set" };
        }

        const isValid = await Bun.password.verify(password, gallery.passwordHash);
        if (!isValid) {
            return { success: false, error: "Invalid password" };
        }

        return { success: true };
    }
}

export const publicService = new PublicService();
