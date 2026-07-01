export class HttpError extends Error {
    public readonly statusCode: number;
    public readonly details?: unknown;

    constructor(statusCode: number, message: string, details?: unknown, options?: ErrorOptions) {
        super(message, options);
        this.name = "HttpError";
        this.statusCode = statusCode;
        this.details = details;
    }
}
