import { expect, test, describe, spyOn } from "bun:test";
import { logger, type LogContext } from "./logger";

describe("Core Logger", () => {
    test("formatError should format Error instances properly", () => {
        // Assert formatError handles standard Error instances
        const err = new Error("Test error message");
        const formatted = (logger as any).formatError(err);
        expect(formatted.message).toBe("Test error message");
        expect(formatted.name).toBe("Error");
    });

    test("formatError should format primitive values as strings", () => {
        const formattedStr = (logger as any).formatError("Raw string error");
        expect(formattedStr.message).toBe("Raw string error");

        const formattedNum = (logger as any).formatError(500);
        expect(formattedNum.message).toBe("500");
    });

    test("formatError should handle nested Error causes", () => {
        const causeErr = new Error("Root cause");
        const mainErr = new Error("Main failure", { cause: causeErr });
        const formatted = (logger as any).formatError(mainErr);
        expect(formatted.message).toBe("Main failure");
        expect(formatted.cause).toBeDefined();
        expect((formatted.cause as any).message).toBe("Root cause");
    });

    test("formatError handles stack based on NODE_ENV", () => {
        const err = new Error("Test stack");
        const originalNodeEnv = process.env.NODE_ENV;

        // In non-development (test/production), stack should be undefined
        process.env.NODE_ENV = "test";
        const formattedTest = (logger as any).formatError(err);
        expect(formattedTest.stack).toBeUndefined();

        // In development, stack should be populated
        process.env.NODE_ENV = "development";
        const formattedDev = (logger as any).formatError(err);
        expect(formattedDev.stack).toBeDefined();

        process.env.NODE_ENV = originalNodeEnv;
    });

    test("info, warn, error, and debug should output correctly structured JSON", () => {
        const logSpy = spyOn(console, "log").mockImplementation(() => {});
        const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
        const errorSpy = spyOn(console, "error").mockImplementation(() => {});

        try {
            const context: LogContext = { requestId: "req-123", userId: "user-456", customField: "val" };
            
            logger.info("Info message", context);
            expect(logSpy).toHaveBeenCalledTimes(1);
            const infoLog = JSON.parse(logSpy.mock.calls[0][0] as string);
            expect(infoLog.level).toBe("info");
            expect(infoLog.message).toBe("Info message");
            expect(infoLog.requestId).toBe("req-123");
            expect(infoLog.userId).toBe("user-456");
            expect(infoLog.customField).toBe("val");
            expect(infoLog.timestamp).toBeDefined();

            logger.warn("Warn message", context, new Error("Warn error"));
            expect(warnSpy).toHaveBeenCalledTimes(1);
            const warnLog = JSON.parse(warnSpy.mock.calls[0][0] as string);
            expect(warnLog.level).toBe("warn");
            expect(warnLog.message).toBe("Warn message");
            expect(warnLog.error).toBeDefined();
            expect(warnLog.error.message).toBe("Warn error");

            logger.error("Error message", context, "String error");
            expect(errorSpy).toHaveBeenCalledTimes(1);
            const errorLog = JSON.parse(errorSpy.mock.calls[0][0] as string);
            expect(errorLog.level).toBe("error");
            expect(errorLog.message).toBe("Error message");
            expect(errorLog.error).toBeDefined();
            expect(errorLog.error.message).toBe("String error");

            logger.debug("Debug message", context);
            // debug prints to console.log as well
            expect(logSpy).toHaveBeenCalledTimes(2);
            const debugLog = JSON.parse(logSpy.mock.calls[1][0] as string);
            expect(debugLog.level).toBe("debug");
            expect(debugLog.message).toBe("Debug message");
        } finally {
            logSpy.mockRestore();
            warnSpy.mockRestore();
            errorSpy.mockRestore();
        }
    });
});
