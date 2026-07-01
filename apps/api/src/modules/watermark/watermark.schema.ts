import { z } from "@hono/zod-openapi";

export const UpdateWatermarkSchema = z.object({
    watermarkType: z.enum(["TEXT", "IMAGE"]),
    watermarkText: z.string().min(1).max(50),
    watermarkOpacity: z.number().min(10).max(100),
}).openapi("UpdateWatermark");

export const UploadWatermarkImageSchema = z.object({
    file: z.any().openapi({ type: "string", format: "binary" }),
}).openapi("UploadWatermarkImage");
