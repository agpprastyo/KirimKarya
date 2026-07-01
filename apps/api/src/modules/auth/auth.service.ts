import { s3 } from "@kirimkarya/storage";
import { db, user } from "@kirimkarya/db";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { HttpError } from "../../core/exceptions/http-error";
import { Readable } from "stream";

export class AuthService {
    /**
     * Processes and uploads a user avatar to S3 via streaming
     * @param fileStream The raw uploaded file stream
     * @param userId The ID of the currently logged-in user
     * @param mimeType The content type of the uploaded file
     * @throws {HttpError} If processing or upload fails
     * @returns The public proxy URL of the uploaded image
     */
    async uploadAvatarStream(fileStream: Readable, userId: string, mimeType: string): Promise<string> {
        try {
            const currentUser = await db
                .select({ image: user.image })
                .from(user)
                .where(eq(user.id, userId))
                .limit(1);

            const oldAvatarUrl = currentUser[0]?.image;

            // Pipeline: Input stream -> Sharp resizing & conversion to WebP -> Web Stream -> S3 write
            const transformer = sharp()
                .resize(512, 512, {
                    fit: "cover",
                    position: "center",
                })
                .webp({ quality: 80 });

            // Pipe input stream to sharp transformer
            fileStream.pipe(transformer);

            // Convert Sharp stream (Readable) to Web ReadableStream
            const webStream = Readable.toWeb(transformer);

            const filename = `avatar/${userId}/${crypto.randomUUID()}.webp`;
            const fileRef = s3.file(filename);

            await fileRef.write(webStream as any, {
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
        } catch (error: unknown) {
            console.error("AuthService.uploadAvatarStream Error:", error);
            throw new HttpError(
                500,
                "Failed to process and upload avatar",
                error instanceof Error ? error.message : String(error)
            );
        }
    }
}

export const authService = new AuthService();
