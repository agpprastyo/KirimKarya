import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nodeEnv = process.env.NODE_ENV || "development";
// Load env-specific file first, then fallback to general .env
dotenv.config({ path: path.resolve(__dirname, `../../../.env.${nodeEnv}`) });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const envSchema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().default(3000),
    WORKER_PORT: z.coerce.number().default(3001),
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_URL: z.string().url().default("http://localhost:3000/api/auth"),
    WEB_URL: z.string().url().default("http://localhost:5173"),
    PUBLIC_WEB_URL: z.string().url().default("http://localhost:5173"),
    PUBLIC_API_URL: z.string().url().default("http://localhost:3000"),
    BETTER_AUTH_SECRET: z.string().min(1),
    REDIS_URL: z.string().default("redis://localhost:6379"),
    STORAGE_USER: z.string().min(1),
    STORAGE_PASSWORD: z.string().min(1),
    STORAGE_ENDPOINT: z.string().url(),
    STORAGE_BUCKET: z.string().min(1),
    STORAGE_REGION: z.string().default("us-east-1"),
    SMTP_HOST: z.string().min(1),
    SMTP_PORT: z.coerce.number().default(587),
    SMTP_USER: z.string().email(),
    SMTP_PASS: z.string().min(1),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    RATE_LIMIT_IP_MAX: z.coerce.number().default(60),
    RATE_LIMIT_USER_MAX: z.coerce.number().default(180),
    DB_POOL_MAX: z.coerce.number().default(10),
    DB_IDLE_TIMEOUT: z.coerce.number().default(20),
    DB_CONNECT_TIMEOUT: z.coerce.number().default(10),
    DB_MIGRATION: z.preprocess((val) => val === "true" || val === true, z.boolean()).default(false),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
