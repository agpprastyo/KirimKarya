import { twoFactorClient, adminClient } from "better-auth/client/plugins"
import { createAuthClient as createSvelteAuthClient } from "better-auth/svelte"

import { env } from "../env";

export const authClient = createSvelteAuthClient({
    baseURL: env.PUBLIC_API_URL || "http://localhost:3000",
    plugins: [
        twoFactorClient(),
        adminClient(),
    ]
});

export const { signIn, signUp, useSession, signOut, resetPassword, requestPasswordReset } = authClient;
