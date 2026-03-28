import { z } from "zod";
import * as publicEnv from "$env/static/public";

const envSchema = z.object({
    PUBLIC_API_URL: z.url().default("http://localhost:3000"),
    PUBLIC_WEB_URL: z.url().default("http://localhost:5173"),
});

export const env = envSchema.parse(publicEnv);
