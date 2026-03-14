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
            const bytes = await file.arrayBuffer();
            const inputBuffer = Buffer.from(bytes);

            // Resize to 512x512 square and compress to WebP
            const processedBuffer = await sharp(inputBuffer)
                .resize(512, 512, {
                    fit: "cover",
                    position: "center",
                })
                .webp({ quality: 80 })
                .toBuffer();

            // S3 Upload Key
            const filename = `avatar/${userId}.webp`;
            const fileRef = s3.file(filename);

            await fileRef.write(processedBuffer, {
                type: "image/webp",
            });

            // Construct proxy URL
            const publicUrl = `/api/images/${filename}`;

            // Update database user record
            await db
                .update(user)
                .set({ image: publicUrl })
                .where(eq(user.id, userId));

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
