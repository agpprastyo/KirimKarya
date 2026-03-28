# Project Architectural Rules

## Storage & Uploads
1. **No Generic Storage Module**: Do not create or use a generic "storage" module or endpoint. All uploads must be handled by functional, dedicated endpoints (e.g., `/api/auth/avatar` for profiles, `/api/galleries/:id/photos` for galleries).
2. **Strict Server-Side Validation**: Every upload endpoint MUST implement strict backend validation using Zod for:
    - **File Size**: (e.g., 5MB for avatars, 50MB for gallery photos).
    - **Mime Type**: (e.g., `image/jpeg`, `image/png`, `image/webp`).
3. **Direct S3 Client Usage**: Use the `@kirimkarya/storage` package directly in specialized controllers or services for S3 operations.
4. **Automated Cleanup**: When updating a file (like an avatar), the server must automatically delete the previously associated file from S3.
5. **Image Processing**: Avatars must be processed on the server (resized to 512x512, converted to WebP) before storage.

## API Structure
1. **Controller-Level Auth**: Prefer handling specific authorization (e.g., prefix ownership checks for images) at the controller level rather than global middleware when possible for more granular control.
2. **Zod OpenAPI**: Always use `@hono/zod-openapi` for route definitions to maintain consistent API documentation.
