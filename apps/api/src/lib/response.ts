import type { Context } from "hono";
import type { StatusCode, ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "@hono/zod-openapi";

/**
 * Custom UUID Validator supporting UUIDv1 to UUIDv7
 */
export const zUuId = () => z.string().regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    "Invalid UUID format"
);

/**
 * Zod Schema Generators for OpenAPI Documentation
 */
export const createApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) => {
    return z.object({
        message: z.string(),
        data: dataSchema,
        meta: z.any().optional(),
    });
};

export const ApiErrorSchema = (message: string = "Internal Server Error", errorDetails: unknown = null) => {
    return z.object({
        message: z.string(),
        error: z.any().optional(),
    });
};

export const DefaultApiErrorSchema = ApiErrorSchema();

/**
 * Standard Pagination Metadata
 */
export interface PaginationMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface ApiSuccessResponse<T = unknown> {
    message: string;
    data: T;
    meta?: Record<string, unknown>;
}

export interface ApiErrorResponse {
    message: string;
    error?: unknown;
}

export interface ApiResponse<T = unknown> {
    success: boolean;
    message: string;
    data?: T;
    meta?: Record<string, unknown>;
    error?: unknown;
}

export const apiResponse = {
    success: <T>(
        data: T,
        message: string = "Success",
        meta?: Record<string, unknown>
    ): ApiSuccessResponse<T> => {
        return {
            message,
            data,
            meta,
        };
    },
    /*  */
    error: (
        message: string = "Internal Server Error",
        errorDetails: unknown = null
    ): ApiErrorResponse => {
        return {
            message,
            error: errorDetails,
        };
    },
};
