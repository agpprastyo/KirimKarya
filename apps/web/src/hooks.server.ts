import { redirect, type Handle } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { paraglideMiddleware } from '$lib/paraglide/server';
import { getTextDirection } from '$lib/paraglide/runtime';

const authHandle: Handle = async ({ event, resolve }) => {
    const sessionToken = event.cookies.get("better-auth.session_token") ||
        event.cookies.get("__secure-better-auth.session_token");



    const isAuthRoute = event.url.pathname.startsWith("/login") ||
        event.url.pathname.startsWith("/register") ||
        event.url.pathname.startsWith("/forgot-password") ||
        event.url.pathname.startsWith("/reset-password");

    const isProtectedRoute = event.url.pathname.startsWith("/dashboard") ||
        event.url.pathname.startsWith("/admin");

    if (sessionToken) {
        if (isAuthRoute) {
            throw redirect(303, "/dashboard");
        }
    } else {
        if (isProtectedRoute) {
            throw redirect(303, "/login");
        }
    }

    const response = await resolve(event);
    return response;
};

const paraglideHandle: Handle = ({ event, resolve }) =>
    paraglideMiddleware(event.request, ({ request: localizedRequest, locale }: { request: Request, locale: string }) => {
        event.request = localizedRequest;
        return resolve(event, {
            transformPageChunk: ({ html }) => {
                return html
                    .replace('%lang%', locale)
                    .replace('%dir%', getTextDirection(locale));
            }
        });
    });

export const handle = sequence(paraglideHandle, authHandle);
