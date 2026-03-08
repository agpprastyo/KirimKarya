import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db, user, session, account, verification, twoFactor } from "@kirimkarya/db";
import { sendEmail } from "@kirimkarya/mail";
import { twoFactor as twoFactorPlugin, admin } from "better-auth/plugins";
import { i18n } from "@better-auth/i18n";
import { env } from "./env";

export const auth = betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
        provider: "pg",
        schema: {
            user,
            session,
            account,
            verification,
            twoFactor,

        },
    }),
    trustedOrigins: ["http://localhost:5173"],
    user: {
        additionalFields: {
            role: {
                type: "string",
                required: false,
                defaultValue: "user",
            },
            subscriptionTier: {
                type: "string",
                required: false,
                defaultValue: "FREE",
            },
        },
    },
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
        sendResetPassword: async ({ user, url, token }) => {
            await sendEmail({
                to: user.email,
                subject: "Reset your password",
                html: `<p>Please reset your password by clicking <a href="${url}">here</a>. Token: ${token}</p>`,
            });
        },
    },
    emailVerification: {
        sendOnSignUp: true,
        sendVerificationEmail: async ({ user, url, token }) => {
            await sendEmail({
                to: user.email,
                subject: "Verify your email address",
                html: `<p>Please verify your email by clicking <a href="${url}">here</a>. Token: ${token}</p>`,
            });
        },
    },
    socialProviders: {
        google: {
            clientId: env.GOOGLE_CLIENT_ID || "",
            clientSecret: env.GOOGLE_CLIENT_SECRET || "",
        },
    },

    plugins: [
        twoFactorPlugin(),
        admin(),
        i18n({
            translations: {
                id: {
                    USER_NOT_FOUND: "Pengguna tidak ditemukan",
                    INVALID_EMAIL_OR_PASSWORD: "Email atau kata sandi tidak valid",
                    INVALID_PASSWORD: "Kata sandi tidak valid",
                    CREDENTIAL_ACCOUNT_NOT_FOUND: "Akun kredensial tidak ditemukan",
                    EMAIL_NOT_VERIFIED: "Email belum diverifikasi",
                    SESSION_EXPIRED: "Sesi telah berakhir",
                    TOO_MANY_REQUESTS: "Terlalu banyak permintaan, silakan coba lagi nanti",
                    EMAIL_ALREADY_IN_USE: "Email sudah digunakan",
                    INTERNAL_SERVER_ERROR: "Terjadi kesalahan internal pada server",
                }
            },
            detection: ["header", "cookie"],
        }),
    ],
});

