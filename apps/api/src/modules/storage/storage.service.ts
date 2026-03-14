import { s3, env as storageEnv } from "@kirimkarya/storage";
import { HttpError } from "../../core/exceptions/http-error";

export class StorageService {
    /**
     * Uploads a generic file to the S3 bucket with user isolation
     * @param file The file to upload
     * @param userId The ID of the user uploading the file
     * @returns The public URL of the uploaded file
     */
    async uploadFile(file: File, userId: string): Promise<string> {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const filename = `${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
        const key = `${userId}/uploads/${filename}`;
        return await this.uploadToKey(key, buffer, file.type);
    }

    async uploadToKey(key: string, body: Buffer, contentType: string): Promise<string> {
        try {
            const fileRef = s3.file(key);

            await fileRef.write(body, {
                type: contentType,
            });

            const publicUrl = `${storageEnv.STORAGE_ENDPOINT}/${storageEnv.STORAGE_BUCKET}/${key}`;
            return publicUrl;
        } catch (error: any) {
            console.error("StorageService.uploadToKey Error:", error);
            throw new HttpError(
                500,
                "Failed to upload file to storage",
                error.message
            );
        }
    }
}

export const storageService = new StorageService();
