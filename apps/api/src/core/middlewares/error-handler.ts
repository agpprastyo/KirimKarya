import type { Context } from "hono";
import { ZodError } from "zod";
import { HttpError } from "../exceptions/http-error";
import { apiResponse } from "../../lib/response";
import { env } from "../../env";

export const errorHandler = (err: Error, c: Context) => {
    // 1. Handle Zod Validation Errors
    if (err instanceof ZodError) {
        const formattedErrors = err.issues.map((e: any) => ({
            field: e.path.join("."),
            message: e.message,
        }));
        return c.json(apiResponse.error("Validation failed", formattedErrors), 400);
    }

    // 2. Handle Custom HttpError
    if (err instanceof HttpError) {
        return c.json(apiResponse.error(err.message, err.details), err.statusCode as any);
    }

    // 3. Fallback Unknown Errors (Internal Server Error)
    console.error(`[ErrorHandler] Uncaught Exception:`, err);
    return c.json(
        apiResponse.error(
            "An unexpected error occurred",
            env.NODE_ENV === "development" ? err.message : null
        ),
        500
    );
};
