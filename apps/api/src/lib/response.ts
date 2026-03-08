import type { Context } from "hono";
import type { StatusCode, ContentfulStatusCode } from "hono/utils/http-status";

/**
 * Standard Pagination Metadata
 */
export interface PaginationMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

/**
 * API Response Class to enforce JSON convention
 */
export const apiResponse = {
    /**
     * Standard Success Response
     */
    success: <T>(c: Context, data: T, message: string = "Operation successful", status: ContentfulStatusCode = 200) => {
        return c.json({
            message,
            data,
        }, status);
    },

    /**
     * Paginated Success Response
     */
    paginated: <T>(
        c: Context,
        data: T[],
        pagination: PaginationMeta,
        message: string = "Data retrieved successfully"
    ) => {
        return c.json({
            message,
            data,
            pagination,
        }, 200);
    },

    /**
     * Standard Error Response
     */
    error: (c: Context, message: string, error: any = null, status: ContentfulStatusCode = 400) => {
        return c.json({
            message,
            error: error || message,
        }, status);
    },
};
