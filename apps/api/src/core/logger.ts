type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogContext {
    requestId?: string;
    userId?: string;
    galleryId?: string;
    method?: string;
    url?: string;
    status?: number;
    durationMs?: number;
    [key: string]: unknown;
}

export class Logger {
    private formatError(error: unknown): Record<string, unknown> {
        if (error instanceof Error) {
            const formatted: Record<string, unknown> = {
                name: error.name,
                message: error.message,
                stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
            };
            if ("cause" in error && error.cause !== undefined) {
                formatted.cause = error.cause instanceof Error ? this.formatError(error.cause) : error.cause;
            }
            return formatted;
        }
        return { message: String(error) };
    }

    private formatLog(level: LogLevel, message: string, context?: LogContext, error?: unknown) {
        const payload: Record<string, unknown> = {
            ...context,
            timestamp: new Date().toISOString(),
            level,
            message,
        };

        if (error !== undefined) {
            payload.error = this.formatError(error);
        }

        return JSON.stringify(payload);
    }

    info(message: string, context?: LogContext) {
        console.log(this.formatLog("info", message, context));
    }

    warn(message: string, context?: LogContext, error?: unknown) {
        console.warn(this.formatLog("warn", message, context, error));
    }

    error(message: string, context?: LogContext, error?: unknown) {
        console.error(this.formatLog("error", message, context, error));
    }

    debug(message: string, context?: LogContext) {
        console.log(this.formatLog("debug", message, context));
    }
}

export const logger = new Logger();
