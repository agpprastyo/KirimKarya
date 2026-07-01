import { expect, test, describe } from "bun:test";
import { apiResponse, createApiResponseSchema, ApiErrorSchema } from "./response";
import { z } from "@hono/zod-openapi";

describe("Response Utility", () => {
    test("createApiResponseSchema creates a schema that validates apiResponse.success data structure", () => {
        const dataSchema = z.object({ id: z.number() });
        const apiResponseSchema = createApiResponseSchema(dataSchema);

        const validObj = {
            message: "All good",
            data: { id: 42 },
            meta: { total: 100 },
        };

        const result = apiResponseSchema.safeParse(validObj);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.data.id).toBe(42);
        }
    });

    test("ApiErrorSchema creates schema that validates apiResponse.error data structure", () => {
        const errorSchema = ApiErrorSchema("Error occurred", "details here");
        
        const validObj = {
            message: "Error occurred",
            error: "details here",
        };

        const result = errorSchema.safeParse(validObj);
        expect(result.success).toBe(true);
    });

    test("apiResponse.success returns standard success payload", () => {
        const payload = apiResponse.success({ item: "value" }, "Updated successfully", { version: 1 });
        expect(payload).toEqual({
            message: "Updated successfully",
            data: { item: "value" },
            meta: { version: 1 },
        });
    });

    test("apiResponse.error returns standard error payload", () => {
        const payload = apiResponse.error("Database connection failure", { code: "ECONNREFUSED" });
        expect(payload).toEqual({
            message: "Database connection failure",
            error: { code: "ECONNREFUSED" },
        });
    });
});
