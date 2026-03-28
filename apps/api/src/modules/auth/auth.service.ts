import { s3 } from "@kirimkarya/storage";
import { db, user } from "@kirimkarya/db";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { HttpError } from "../../core/exceptions/http-error";

export class AuthService {
    /**
     * Processes and uploads a user avatar to S3
     * @param file The raw uploaded File object
     * @param userId The ID of the currently logged-in user
     * @throws {HttpError} If processing or upload fails
     * @returns The public proxy URL of the uploaded image
     */
    async uploadAvatar(file: File, userId: string): Promise<string> {
        try {
            const currentUser = await db
                .select({ image: user.image })
                .from(user)
                .where(eq(user.id, userId))
                .limit(1);

            const oldAvatarUrl = currentUser[0]?.image;

            const bytes = await file.arrayBuffer();
            const inputBuffer = Buffer.from(bytes);

            const processedBuffer = await sharp(inputBuffer)
                .resize(512, 512, {
                    fit: "cover",
                    position: "center",
                })
                .webp({ quality: 80 })
                .toBuffer();

            const filename = `avatar/${userId}/${crypto.randomUUID()}.webp`;
            const fileRef = s3.file(filename);

            await fileRef.write(processedBuffer, {
                type: "image/webp",
            });

            const publicUrl = `/api/images/${filename}`;

            await db
                .update(user)
                .set({ image: publicUrl })
                .where(eq(user.id, userId));

            if (oldAvatarUrl && oldAvatarUrl.startsWith("/api/images/avatar/")) {
                const oldKey = oldAvatarUrl.replace("/api/images/", "");
                try {
                    await s3.file(oldKey).delete();
                } catch (err) {
                    console.warn(`[Cleanup] Failed to delete old avatar at ${oldKey}:`, err);
                }
            }

            return publicUrl;
        } catch (error: any) {
            console.error("AuthService.uploadAvatar Error:", error);
            throw new HttpError(
                500,
                "Failed to process and upload avatar",
                error.message
            );
        }
    }
}


export const authService = new AuthService();
