import { s3, env as storageEnv } from "@kirimkarya/storage";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { HttpError } from "../../core/exceptions/http-error";

export class ImagesService {
    /**
     * Retrieves an image from the S3 bucket
     * @param key The object key (path) in the bucket
     * @returns An object containing the ByteArray and ContentType
     */
    async getImage(key: string): Promise<{ bytes: Uint8Array; contentType: string }> {
        try {
            const command = new GetObjectCommand({
                Bucket: storageEnv.STORAGE_BUCKET,
                Key: key,
            });

            const response = await s3.send(command);

            if (!response.Body) {
                throw new HttpError(404, "Image body is empty");
            }

            // Convert S3 Body to ByteArray
            const bytes = await response.Body.transformToByteArray();

            return {
                bytes,
                contentType: response.ContentType || "image/jpeg",
            };
        } catch (error: any) {
            console.error("ImagesService.getImage Error:", error);
            // S3 NoSuchKey usually throws 404
            throw new HttpError(404, "Image not found", error.message);
        }
    }
}

export const imagesService = new ImagesService();
