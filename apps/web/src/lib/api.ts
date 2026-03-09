import { hc } from "hono/client";
import type { AppType } from "../../../api/src/index";
import { env } from "../env";

const apiUrl = env.PUBLIC_API_URL || "http://localhost:3000";

export const api = hc<AppType>(apiUrl);
