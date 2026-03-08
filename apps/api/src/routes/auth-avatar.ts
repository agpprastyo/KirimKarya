import { Hono } from "hono";
import { s3, env as storageEnv } from "@kirimkarya/storage";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { apiResponse } from "../lib/response";
import { auth } from "../auth";
import { db, user } from "@kirimkarya/db";
import { eq } from "drizzle-orm";
import sharp from "sharp";

const avatar = new Hono();

avatar.post("/api/auth/upload-avatar", async (c) => {
    try {
        const session = await auth.api.getSession({
            headers: c.req.raw.headers,
        });

        if (!session || !session.user) {
            return apiResponse.error(c, "Unauthorized", null, 401);
        }

        const body = await c.req.parseBody();
        const file = body["file"] as File;

        if (!file) {
            return apiResponse.error(c, "No file provided", null, 400);
        }

        // Image Processing with Sharp
        const bytes = await file.arrayBuffer();
        const inputBuffer = Buffer.from(bytes);

        // 1. Resize to 512x512 square
        // 2. Compress to webp (efficient) or jpeg
        const processedBuffer = await sharp(inputBuffer)
            .resize(512, 512, {
                fit: "cover",
                position: "center",
            })
            .webp({ quality: 80 })
            .toBuffer();

        // Check size (< 200KB)
        if (processedBuffer.length > 200 * 1024) {
            // Further compress if needed
            // (Optional, sharp usually handles this well with quality 80)
        }

        const filename = `avatar/${session.user.id}.webp`;

        await s3.send(
            new PutObjectCommand({
                Bucket: storageEnv.STORAGE_BUCKET,
                Key: filename,
                Body: processedBuffer,
                ContentType: "image/webp",
            })
        );

        // Construct proxy URL
        const publicUrl = `/api/images/${filename}`;

        // Update database user record
        await db.update(user)
            .set({ image: publicUrl })
            .where(eq(user.id, session.user.id));

        return apiResponse.success(c, { url: publicUrl }, "Avatar uploaded successfully");
    } catch (e: any) {
        console.error("Avatar Upload Error:", e);
        return apiResponse.error(c, "Failed to upload avatar", e.message, 500);
    }
});

export { avatar };
