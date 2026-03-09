import { s3, env as storageEnv } from "@kirimkarya/storage";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { HttpError } from "../../core/exceptions/http-error";

export class StorageService {
    /**
     * Uploads a generic file to the S3 bucket
     * @param file The file to upload
     * @returns The public URL of the uploaded file
     */
    async uploadFile(file: File): Promise<string> {
        try {
            const bytes = await file.arrayBuffer();
            const buffer = Buffer.from(bytes);
            const filename = `${Date.now()}-${file.name.replace(/\s+/g, "-")}`;

            await s3.send(
                new PutObjectCommand({
                    Bucket: storageEnv.STORAGE_BUCKET,
                    Key: filename,
                    Body: buffer,
                    ContentType: file.type,
                })
            );

            // Construct public URL
            const publicUrl = `${storageEnv.STORAGE_ENDPOINT}/${storageEnv.STORAGE_BUCKET}/${filename}`;
            return publicUrl;
        } catch (error: any) {
            console.error("StorageService.uploadFile Error:", error);
            throw new HttpError(
                500,
                "Failed to upload file to storage",
                error.message
            );
        }
    }
}

export const storageService = new StorageService();
