import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const envSchema = z.object({
    STORAGE_USER: z.string().min(1),
    STORAGE_PASSWORD: z.string().min(1),
    STORAGE_ENDPOINT: z.string().url(),
    STORAGE_BUCKET: z.string().min(1),
    STORAGE_REGION: z.string().default("us-east-1"),
});

export const env = envSchema.parse(process.env);
