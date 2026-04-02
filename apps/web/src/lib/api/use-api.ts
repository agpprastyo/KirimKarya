import { createQuery, createMutation, type CreateQueryOptions, type CreateMutationOptions } from "@tanstack/svelte-query";
import { api } from "./client";
import type { InferRequestType, InferResponseType, ClientResponse } from "hono/client";

/**
 * Helper to handle Hono Client Response and parse JSON
 * Throws error if response is not OK
 */
export async function handleResponse<T>(res: Promise<ClientResponse<T>> | ClientResponse<T>) {
    const response = await res;
    if (!response.ok) {
        let errorMessage = response.statusText || "Request failed";
        try {
            const errorData = (await response.json()) as any;
            errorMessage = errorData?.message || errorMessage;
        } catch {
            // ignore JSON parse error, use default message
        }
        throw new Error(errorMessage);
    }
    return (await response.json()) as T;
}

/**
 * Use this to infer response type from a Hono client method
 * Example: type ListPhotosRes = ApiResult<typeof api.api.photos.$get>
 */
export type ApiResult<T extends (...args: any[]) => any> = InferResponseType<T>;

/**
 * Use this to infer request type from a Hono client method
 * Example: type UploadPhotoReq = ApiRequest<typeof api.api.photos.$post>
 */
export type ApiRequest<T extends (...args: any[]) => any> = InferRequestType<T>;

/**
 * Example usage:
 * const photos = createQuery({
 *   queryKey: ['photos', galleryId],
 *   queryFn: () => handleResponse(api.api.photos.$get({ query: { galleryId } }))
 * });
 */
