import { Hono } from "hono";
import { s3, env as storageEnv } from "@kirimkarya/storage";
import { GetObjectCommand } from "@aws-sdk/client-s3";

const images = new Hono();

images.get("/*", async (c) => {
    const key = c.req.path.replace("/api/images/", "");

    try {
        const command = new GetObjectCommand({
            Bucket: storageEnv.STORAGE_BUCKET,
            Key: key,
        });

        const response = await s3.send(command);

        if (!response.Body) {
            return c.text("Image not found", 404);
        }

        // Convert S3 Body to a readable stream for Hono
        // Response.Body is a SDK-internal type, we convert it to Uint8Array or stream
        const bytes = await response.Body.transformToByteArray();

        return c.body(bytes as any, 200, {
            "Content-Type": response.ContentType || "image/jpeg",
            "Cache-Control": "public, max-age=31536000, immutable",
        });
    } catch (e) {
        console.error("Proxy Error:", e);
        return c.text("Image not found", 404);
    }
});

export { images };
