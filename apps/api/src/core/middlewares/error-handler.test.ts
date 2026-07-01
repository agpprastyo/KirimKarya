import { expect, test, describe, spyOn } from "bun:test";
import { errorHandler } from "./error-handler";
import { ZodError } from "zod";
import { HttpError } from "../exceptions/http-error";
import type { Context } from "hono";

describe("ErrorHandler Middleware", () => {
    test("should format ZodError and return 400 status code", () => {
        const zodError = new ZodError([
            {
                code: "custom",
                path: ["body", "name"],
                message: "Expected string, received number",
            },
        ]);

        const mockContextObj = {
            json: (body: any, status: number) => ({ body, status }),
        };
        const jsonMock = spyOn(mockContextObj, "json");

        const c = mockContextObj as unknown as Context;

        const response = errorHandler(zodError, c) as any;

        expect(jsonMock).toHaveBeenCalledTimes(1);
        expect(response).toEqual({
            status: 400,
            body: {
                message: "Validation failed",
                error: [
                    {
                        field: "body.name",
                        message: "Expected string, received number",
                    },
                ],
            },
        });
    });

    test("should format HttpError with custom status code and details", () => {
        const httpError = new HttpError(418, "I'm a teapot", { coffee: "none" });

        const mockContextObj = {
            json: (body: any, status: number) => ({ body, status }),
        };
        const jsonMock = spyOn(mockContextObj, "json");

        const c = mockContextObj as unknown as Context;

        const response = errorHandler(httpError, c) as any;

        expect(jsonMock).toHaveBeenCalledTimes(1);
        expect(response).toEqual({
            status: 418,
            body: {
                message: "I'm a teapot",
                error: { coffee: "none" },
            },
        });
    });

    test("should format generic unexpected errors and return 500 status code", () => {
        const genericError = new Error("Something blew up");
        const consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});

        const mockContextObj = {
            json: (body: any, status: number) => ({ body, status }),
        };
        const jsonMock = spyOn(mockContextObj, "json");

        const c = mockContextObj as unknown as Context;

        try {
            const response = errorHandler(genericError, c) as any;

            expect(jsonMock).toHaveBeenCalledTimes(1);
            expect(response.status).toBe(500);
            expect(response.body.message).toBe("An unexpected error occurred");
        } finally {
            consoleErrorSpy.mockRestore();
        }
    });
});
