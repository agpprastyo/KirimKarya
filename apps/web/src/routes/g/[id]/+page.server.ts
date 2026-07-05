import type { PageServerLoad } from "./$types";
import { env } from "../../../env";

const apiUrl = env.PUBLIC_API_URL || "http://localhost:3000";

export interface PublicGallery {
    id: string;
    title: string;
    clientEmail: string | null;
    status: string;
    deliveryStatus: string;
    isPrivate: boolean;
    accessMode: "OTP" | "PASSWORD";
    selectionLimit: number;
    pricePerExtraPhoto: number;
    createdAt: string;
    deliveredAt?: string | null;
    deliveryZipKey?: string | null;
}

export interface PublicPhoto {
    id: string;
    thumbnailUrl: string | null;
    watermarkUrl: string | null;
    isSelected: boolean;
    comment: string | null;
}

/**
 * SSR load: fetch gallery metadata and photos server-side so public galleries get
 * proper <title>, meta description, and first paint without client-side waterfall.
 */
export const load: PageServerLoad = async ({ params, request, cookies }: Parameters<PageServerLoad>[0]) => {
    const { id } = params;

    // Retrieve or generate a server-persistent client identifier cookie
    let clientId = cookies.get("kirimkarya_client_id");
    if (!clientId) {
        clientId = crypto.randomUUID();
        cookies.set("kirimkarya_client_id", clientId, {
            path: "/",
            maxAge: 60 * 60 * 24 * 365, // 1 year
            httpOnly: false, // readable by client JS if needed
            sameSite: "lax",
            secure: import.meta.env.PROD,
        });
    }

    try {
        const res = await fetch(`${apiUrl}/api/v1/public/galleries/${id}`, {
            headers: {
                // Forward cookies so private gallery access tokens work on SSR
                cookie: request.headers.get("cookie") ?? "",
            },
        });

        if (res.status === 403) {
            const data = (await res.json().catch(() => ({}))) as { error?: string };
            return {
                gallery: null,
                isDraft: data.error === "Gallery not published yet",
                accessRequired: data.error !== "Gallery not published yet",
                isExpired: false,
                photos: [],
                clientId,
            };
        }

        if (!res.ok) {
            return { gallery: null, isDraft: false, accessRequired: false, isExpired: false, photos: [], clientId };
        }

        const data = (await res.json()) as { data: PublicGallery };
        const gallery = data.data;

        // @ts-expect-error: expiresAt is not defined on PublicGallery type but is present at runtime
        const isExpired = gallery.expiresAt && new Date(gallery.expiresAt) < new Date();

        let photos: PublicPhoto[] = [];
        let accessRequired = false;

        if (!isExpired && gallery) {
            const photosRes = await fetch(`${apiUrl}/api/v1/public/galleries/${id}/photos`, {
                headers: {
                    cookie: request.headers.get("cookie") ?? "",
                    "x-client-id": clientId,
                },
            });

            if (photosRes.ok) {
                const photosData = (await photosRes.json()) as { data?: PublicPhoto[] };
                photos = photosData.data || [];
            } else if (photosRes.status === 403) {
                accessRequired = true;
            }
        }

        return {
            gallery,
            isExpired: !!isExpired,
            isDraft: false,
            accessRequired,
            photos,
            clientId,
        };
    } catch {
        return { gallery: null, isDraft: false, accessRequired: false, isExpired: false, photos: [], clientId };
    }
};

