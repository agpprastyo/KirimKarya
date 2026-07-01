import { db, galleries, photos, feedbacks, galleryAccess } from "@kirimkarya/db";
import { eq, and, sql } from "drizzle-orm";
import { redis } from "@kirimkarya/redis";
import { sendOTPEmail } from "@kirimkarya/mail";
import { createHash, randomBytes } from "crypto";

// SEC-3: Brute-force protection — max 5 attempts per 15 minutes per gallery+email
const MAX_VERIFY_ATTEMPTS = 5;
const VERIFY_WINDOW_SECONDS = 15 * 60;

async function checkRateLimit(galleryId: string, email: string, action: string): Promise<boolean> {
    const key = `ratelimit:${action}:${galleryId}:${email}`;
    const attempts = await redis.incr(key);
    if (attempts === 1) {
        await redis.expire(key, VERIFY_WINDOW_SECONDS);
    }
    return attempts <= MAX_VERIFY_ATTEMPTS;
}

// SEC-5: Generate an opaque access token (not raw email) to store in the cookie
function generateAccessToken(galleryId: string, email: string): string {
    const salt = randomBytes(16).toString("hex");
    return createHash("sha256").update(`${galleryId}:${email}:${salt}`).digest("hex") + "." + salt;
}

export class PublicService {
    async getGalleryMetadata(id: string) {
        const cacheKey = `cache:gallery:${id}:metadata`;
        const cached = await redis.get(cacheKey);

        let gallery;
        if (cached) {
            gallery = JSON.parse(cached);
            gallery.createdAt = new Date(gallery.createdAt);
            if (gallery.deliveredAt) gallery.deliveredAt = new Date(gallery.deliveredAt);
        } else {
            const [fetched] = await db
                .select({
                    id: galleries.id,
                    title: galleries.title,
                    clientEmail: galleries.clientEmail,
                    status: galleries.status,
                    deliveryStatus: galleries.deliveryStatus,
                    isPrivate: galleries.isPrivate,
                    userId: galleries.userId,
                    accessMode: galleries.accessMode,
                    selectionLimit: galleries.selectionLimit,
                    pricePerExtraPhoto: galleries.pricePerExtraPhoto,
                    createdAt: galleries.createdAt,
                    deliveredAt: galleries.deliveredAt,
                    deliveryZipKey: galleries.deliveryZipKey,
                })
                .from(galleries)
                .where(eq(galleries.id, id));

            gallery = fetched;
            if (gallery) {
                await redis.set(cacheKey, JSON.stringify(gallery));
                await redis.expire(cacheKey, 3600); // 1 hour TTL
            }
        }

        if (gallery && gallery.status === "PUBLISHED") {
            db.execute(sql`UPDATE galleries SET views = views + 1 WHERE id = ${id}`).catch(err => {
                console.error("Failed to increment gallery views:", err);
            });
        }

        return gallery;
    }

    async getGalleryPhotos(galleryId: string): Promise<{
        id: string;
        thumbnailS3Key: string | null;
        watermarkS3Key: string | null;
    }[]> {
        const cacheKey = `cache:gallery:${galleryId}:photos`;
        const cached = await redis.get(cacheKey);
        if (cached) {
            return JSON.parse(cached) as {
                id: string;
                thumbnailS3Key: string | null;
                watermarkS3Key: string | null;
            }[];
        }

        const list = await db
            .select({
                id: photos.id,
                thumbnailS3Key: photos.thumbnailS3Key,
                watermarkS3Key: photos.watermarkS3Key,
            })
            .from(photos)
            .where(and(eq(photos.galleryId, galleryId), eq(photos.status, 'READY')))
            .orderBy(photos.uploadedAt);

        await redis.set(cacheKey, JSON.stringify(list));
        await redis.expire(cacheKey, 3600); // 1 hour TTL
        return list;
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

        // SEC-3: Rate limit OTP generation requests to prevent email spam/bombing (max 3 requests per 5 minutes)
        const requestLimitKey = `ratelimit:request-otp:${galleryId}:${email}`;
        const requestAttempts = (await redis.incr(requestLimitKey)) as number;
        if (requestAttempts === 1) {
            await redis.expire(requestLimitKey, 5 * 60);
        }
        if (requestAttempts > 3) {
            return { success: false, error: "Too many OTP requests. Please wait 5 minutes before trying again." };
        }

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
        // SEC-3: Rate limit OTP verification attempts
        const allowed = await checkRateLimit(galleryId, email, "otp");
        if (!allowed) {
            return { success: false, error: "Too many attempts. Please wait 15 minutes before trying again." };
        }

        const redisKey = `otp:${galleryId}:${email}`;
        const storedOtp = await redis.get(redisKey);

        if (!storedOtp || storedOtp !== code) {
            return { success: false, error: "Invalid or expired verification code" };
        }

        // On successful verification, clear the brute-force attempts and request limit locks
        await redis.del(redisKey);
        await redis.del(`ratelimit:otp:${galleryId}:${email}`);
        await redis.del(`ratelimit:request-otp:${galleryId}:${email}`);

        // SEC-5: Return an opaque token to store in cookie instead of raw email
        const accessToken = generateAccessToken(galleryId, email);
        // Store the mapping so we can resolve the token later if needed
        await redis.set(`access_token:${galleryId}:${accessToken}`, email, "EX", 60 * 60 * 24 * 7);

        return { success: true, accessToken };
    }

    async verifyStaticPassword(galleryId: string, email: string, password: string) {
        // SEC-3: Rate limit password verification attempts
        const allowed = await checkRateLimit(galleryId, email, "password");
        if (!allowed) {
            return { success: false, error: "Too many attempts. Please wait 15 minutes before trying again." };
        }

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

        // On successful verification, clear static password rate-limiting attempts lock
        await redis.del(`ratelimit:password:${galleryId}:${email}`);

        // SEC-5: Return an opaque token to store in cookie instead of raw email
        const accessToken = generateAccessToken(galleryId, email);
        await redis.set(`access_token:${galleryId}:${accessToken}`, email, "EX", 60 * 60 * 24 * 7);

        return { success: true, accessToken };
    }

    async resolveClientEmail(galleryId: string, token: string | undefined): Promise<string | null> {
        if (!token) return null;
        const email = await redis.get(`access_token:${galleryId}:${token}`);
        return (email as string) || null;
    }
}

export const publicService = new PublicService();
