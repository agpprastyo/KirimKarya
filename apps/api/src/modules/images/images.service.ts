import { s3 } from "@kirimkarya/storage";
import { HttpError } from "../../core/exceptions/http-error";

export class ImagesService {
    /**
     * Retrieves an image from the S3 bucket
     * @param key The object key (path) in the bucket
     * @returns An object containing the ByteArray and ContentType
     */
    async getImage(key: string): Promise<{ bytes: Uint8Array; contentType: string }> {
        try {
            console.log("🔍 ImagesService.getImage - S3 Key:", key);
            const fileRef = s3.file(key);

            const exists = await fileRef.exists();
            if (!exists) {
                throw new HttpError(404, "Image not found");
            }

            const bytes = await fileRef.bytes();

            return {
                bytes,
                contentType: fileRef.type || "image/jpeg",
            };
        } catch (error: any) {
            console.error("ImagesService.getImage Error:", error);
            throw new HttpError(404, "Image not found", error.message);
        }
    }
}

export const imagesService = new ImagesService();
