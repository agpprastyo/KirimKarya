import { s3, withS3Breaker } from "@kirimkarya/storage";
import { HttpError } from "../../core/exceptions/http-error";

export class ImagesService {
    /**
     * Retrieves an image from the S3 bucket as a stream
     * @param key The object key (path) in the bucket
     * @returns An object containing the ReadableStream and ContentType
     */
    async getImageStream(key: string): Promise<{ stream: ReadableStream<Uint8Array>; contentType: string }> {
        try {
            console.log("🔍 ImagesService.getImageStream - S3 Key:", key);
            const fileRef = s3.file(key);

            const exists = await withS3Breaker(() => fileRef.exists());
            if (!exists) {
                throw new HttpError(404, "Image not found");
            }

            const stream = fileRef.stream();

            return {
                stream,
                contentType: fileRef.type || "image/jpeg",
            };
        } catch (error: unknown) {
            console.error("ImagesService.getImageStream Error:", error);
            throw new HttpError(404, "Image not found", error instanceof Error ? error.message : String(error));
        }
    }
}

export const imagesService = new ImagesService();

