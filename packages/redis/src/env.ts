import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const envSchema = z.object({
    REDIS_URL: z.string().url().default("redis://localhost:6379"),
});

export const env = envSchema.parse(process.env);
