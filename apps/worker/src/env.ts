import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const envSchema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    WORKER_PORT: z.coerce.number().default(3001),
    DATABASE_URL: z.string().min(1),
    WEB_URL: z.string().url().default("http://localhost:5173"),
    REDIS_URL: z.string().url().default("redis://localhost:6379"),
});

export const env = envSchema.parse(process.env);
