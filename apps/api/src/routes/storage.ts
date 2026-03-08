import { Hono } from "hono";
import { s3, env as storageEnv } from "@kirimkarya/storage";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { apiResponse } from "../lib/response";

const storage = new Hono();

storage.post("/upload", async (c) => {
    try {
        const body = await c.req.parseBody();
        const file = body["file"] as File;

        if (!file) {
            return apiResponse.error(c, "No file provided", null, 400);
        }

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
        // Using STORAGE_ENDPOINT as base, ensuring it doesn't have internal network names if used for public access
        const publicUrl = `${storageEnv.STORAGE_ENDPOINT}/${storageEnv.STORAGE_BUCKET}/${filename}`;

        return apiResponse.success(c, { url: publicUrl }, "File uploaded successfully");
    } catch (e: any) {
        console.error("Upload Error:", e);
        return apiResponse.error(c, "Failed to upload file", e.message, 500);
    }
});

export { storage };
