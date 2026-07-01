import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "@kirimkarya/env";

const maxConnections = env.DB_MIGRATION ? 1 : env.DB_POOL_MAX;

const client = postgres(env.DATABASE_URL, {
    max: maxConnections,
    idle_timeout: env.DB_IDLE_TIMEOUT,
    connect_timeout: env.DB_CONNECT_TIMEOUT,
});

export const db = drizzle(client, { schema });
export const pgClient = client;
