import type { Context } from "hono";
import type { StatusCode, ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "@hono/zod-openapi";

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

export const ApiErrorSchema = (message: string = "Internal Server Error", errorDetails: any = null) => {
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

export interface ApiSuccessResponse<T = any> {
    message: string;
    data: T;
    meta?: any;
}

export interface ApiErrorResponse {
    message: string;
    error?: any;
}

export const apiResponse = {
    success: <T>(
        data: T,
        message: string = "Success",
        meta?: any
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
        errorDetails: any = null
    ): ApiErrorResponse => {
        return {
            message,
            error: errorDetails,
        };
    },
};
