import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { apiResponse, createApiResponseSchema, ApiErrorSchema } from "../../lib/response";
import { db, user, galleries, photos } from "@kirimkarya/db";
import { eq, sql, count, desc, and, or, like } from "drizzle-orm";
import { s3 } from "@kirimkarya/storage";
import type { HonoEnv } from "../../core/types/hono";
import { photoQueue, notificationQueue, cleanupQueue, deliveryQueue } from "@kirimkarya/queue";
import { Queue, Job } from "bullmq";

const adminRoutes = new OpenAPIHono<HonoEnv>();

const getQueueByName = (name: string) => {
    switch (name) {
        case "photo-processing":
            return photoQueue;
        case "notifications":
            return notificationQueue;
        case "cleanup":
            return cleanupQueue;
        case "delivery":
            return deliveryQueue;
        default:
            return null;
    }
};

const getQueueStats = async (queue: Queue, name: string) => {
    const [active, waiting, delayed, failed, completed] = await Promise.all([
        queue.getActiveCount(),
        queue.getWaitingCount(),
        queue.getDelayedCount(),
        queue.getFailedCount(),
        queue.getCompletedCount(),
    ]);
    return {
        name,
        active,
        waiting,
        delayed,
        failed,
        completed,
    };
};

const getFailedJobs = async (queue: Queue, name: string) => {
    const jobs = await queue.getFailed(0, 50);
    return jobs.map((job: Job) => ({
        id: job.id || "",
        name: job.name,
        queueName: name,
        data: job.data,
        failedReason: job.failedReason || null,
        stacktrace: job.stacktrace || null,
        timestamp: job.timestamp,
    }));
};

// GET Stats Summary Route
const getAdminStatsRoute = createRoute({
    summary: "Get Platform Stats Summary",
    tags: ["Admin"],
    method: "get",
    path: "/stats/summary",
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: createApiResponseSchema(
                        z.object({
                            stats: z.object({
                                totalUsers: z.number(),
                                totalGalleries: z.number(),
                                totalPhotos: z.number(),
                                totalViews: z.number(),
                                storageUsedBytes: z.number(),
                                activeUsersCount: z.number(),
                                newSignupsCount: z.number(),
                            }),
                        })
                    ),
                },
            },
            description: "Platform stats retrieved successfully",
        },
        401: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Unauthorized"),
                },
            },
            description: "Unauthorized",
        },
        403: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Forbidden"),
                },
            },
            description: "Forbidden / Access Denied",
        },
        500: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Internal Server Error"),
                },
            },
            description: "Internal Server Error",
        },
    },
});

// GET Global Galleries List Route
const getAdminGalleriesRoute = createRoute({
    summary: "Get All Galleries",
    tags: ["Admin"],
    method: "get",
    path: "/galleries",
    request: {
        query: z.object({
            limit: z.string().optional().default("10"),
            offset: z.string().optional().default("0"),
            search: z.string().optional(),
        }),
    },
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: createApiResponseSchema(
                        z.object({
                            galleries: z.array(
                                z.object({
                                    id: z.string(),
                                    title: z.string(),
                                    clientEmail: z.string().nullable(),
                                    status: z.string(),
                                    accessMode: z.string(),
                                    views: z.number(),
                                    createdAt: z.string(),
                                    user: z.object({
                                        id: z.string(),
                                        name: z.string(),
                                        email: z.string(),
                                    }),
                                    photoCount: z.number(),
                                })
                            ),
                            total: z.number(),
                        })
                    ),
                },
            },
            description: "Galleries list retrieved successfully",
        },
        401: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Unauthorized"),
                },
            },
            description: "Unauthorized",
        },
        403: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Forbidden"),
                },
            },
            description: "Forbidden / Access Denied",
        },
        500: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Internal Server Error"),
                },
            },
            description: "Internal Server Error",
        },
    },
});

// PUT Administrative Gallery Status Override Route
const updateAdminGalleryStatusRoute = createRoute({
    summary: "Override Gallery Status",
    tags: ["Admin"],
    method: "put",
    path: "/galleries/{id}/status",
    request: {
        params: z.object({
            id: z.string(),
        }),
        body: {
            content: {
                "application/json": {
                    schema: z.object({
                        status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
                    }),
                },
            },
        },
    },
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: createApiResponseSchema(z.object({ success: z.boolean() })),
                },
            },
            description: "Gallery status overridden successfully",
        },
        401: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Unauthorized"),
                },
            },
            description: "Unauthorized",
        },
        403: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Forbidden"),
                },
            },
            description: "Forbidden",
        },
        500: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Internal Server Error"),
                },
            },
            description: "Internal Server Error",
        },
    },
});

// DELETE Admin Gallery Route (Cascade + clean)
const deleteAdminGalleryRoute = createRoute({
    summary: "Delete Gallery (Cascade Purge)",
    tags: ["Admin"],
    method: "delete",
    path: "/galleries/{id}",
    request: {
        params: z.object({
            id: z.string(),
        }),
    },
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: createApiResponseSchema(z.object({ success: z.boolean() })),
                },
            },
            description: "Gallery deleted successfully",
        },
        401: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Unauthorized"),
                },
            },
            description: "Unauthorized",
        },
        403: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Forbidden"),
                },
            },
            description: "Forbidden",
        },
        500: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Internal Server Error"),
                },
            },
            description: "Internal Server Error",
        },
    },
});

// GET Jobs Status Route
const getAdminJobsStatusRoute = createRoute({
    summary: "Get Background Job Queues Status",
    tags: ["Admin"],
    method: "get",
    path: "/jobs/status",
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: createApiResponseSchema(
                        z.object({
                            queues: z.array(
                                z.object({
                                    name: z.string(),
                                    active: z.number(),
                                    waiting: z.number(),
                                    delayed: z.number(),
                                    failed: z.number(),
                                    completed: z.number(),
                                })
                            ),
                            failedJobs: z.array(
                                z.object({
                                    id: z.string(),
                                    name: z.string(),
                                    queueName: z.string(),
                                    data: z.any(),
                                    failedReason: z.string().nullable(),
                                    stacktrace: z.array(z.string()).nullable(),
                                    timestamp: z.number(),
                                })
                            ),
                        })
                    ),
                },
            },
            description: "Queues status retrieved successfully",
        },
        401: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Unauthorized"),
                },
            },
            description: "Unauthorized",
        },
        403: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Forbidden"),
                },
            },
            description: "Forbidden",
        },
        500: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Internal Server Error"),
                },
            },
            description: "Internal Server Error",
        },
    },
});

// POST Retry Failed Job Route
const retryAdminJobRoute = createRoute({
    summary: "Retry Failed Job",
    tags: ["Admin"],
    method: "post",
    path: "/jobs/{queue}/{id}/retry",
    request: {
        params: z.object({
            queue: z.string(),
            id: z.string(),
        }),
    },
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: createApiResponseSchema(z.object({ success: z.boolean() })),
                },
            },
            description: "Job retried successfully",
        },
        401: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Unauthorized"),
                },
            },
            description: "Unauthorized",
        },
        403: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Forbidden"),
                },
            },
            description: "Forbidden",
        },
        404: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Not Found"),
                },
            },
            description: "Job or Queue not found",
        },
        500: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Internal Server Error"),
                },
            },
            description: "Internal Server Error",
        },
    },
});

// POST Retry All Failed Jobs Route
const retryAllAdminJobsRoute = createRoute({
    summary: "Retry All Failed Jobs in Queue",
    tags: ["Admin"],
    method: "post",
    path: "/jobs/:queue/retry-all",
    request: {
        params: z.object({
            queue: z.string(),
        }),
    },
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: createApiResponseSchema(z.object({ success: z.boolean(), count: z.number() })),
                },
            },
            description: "All failed jobs in queue scheduled for retry",
        },
        401: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Unauthorized"),
                },
            },
            description: "Unauthorized",
        },
        403: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Forbidden"),
                },
            },
            description: "Forbidden",
        },
        404: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Not Found"),
                },
            },
            description: "Queue not found",
        },
        500: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Internal Server Error"),
                },
            },
            description: "Internal Server Error",
        },
    },
});

// DELETE Remove Failed Job Route
const deleteAdminJobRoute = createRoute({
    summary: "Remove Failed Job",
    tags: ["Admin"],
    method: "delete",
    path: "/jobs/{queue}/{id}",
    request: {
        params: z.object({
            queue: z.string(),
            id: z.string(),
        }),
    },
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: createApiResponseSchema(z.object({ success: z.boolean() })),
                },
            },
            description: "Job deleted successfully",
        },
        401: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Unauthorized"),
                },
            },
            description: "Unauthorized",
        },
        403: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Forbidden"),
                },
            },
            description: "Forbidden",
        },
        404: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Not Found"),
                },
            },
            description: "Job or Queue not found",
        },
        500: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Internal Server Error"),
                },
            },
            description: "Internal Server Error",
        },
    },
});

// DELETE Purge All Failed Jobs Route
const purgeAllFailedAdminJobsRoute = createRoute({
    summary: "Purge All Failed Jobs in Queue",
    tags: ["Admin"],
    method: "delete",
    path: "/jobs/:queue/purge-failed",
    request: {
        params: z.object({
            queue: z.string(),
        }),
    },
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: createApiResponseSchema(z.object({ success: z.boolean(), count: z.number() })),
                },
            },
            description: "All failed jobs purged successfully",
        },
        401: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Unauthorized"),
                },
            },
            description: "Unauthorized",
        },
        403: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Forbidden"),
                },
            },
            description: "Forbidden",
        },
        404: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Not Found"),
                },
            },
            description: "Queue not found",
        },
        500: {
            content: {
                "application/json": {
                    schema: ApiErrorSchema("Internal Server Error"),
                },
            },
            description: "Internal Server Error",
        },
    },
});

const routes = adminRoutes
    .openapi(getAdminStatsRoute, async (c) => {
        try {
            // Aggregated counts from PostgreSQL
            const [usersCountResult] = await db.select({ count: count() }).from(user);
            const [galleriesCountResult] = await db.select({ count: count() }).from(galleries);
            const [photosCountResult] = await db.select({ count: count() }).from(photos);
            const [viewsSumResult] = await db.select({ totalViews: sql<number>`COALESCE(SUM(${galleries.views}), 0)` }).from(galleries);

            // Active signups and users count in the last 7 days
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const [newSignupsResult] = await db
                .select({ count: count() })
                .from(user)
                .where(sql`${user.createdAt} >= ${sevenDaysAgo}`);

            const [activeUsersResult] = await db
                .select({ count: sql<number>`COUNT(DISTINCT ${galleries.userId})` })
                .from(galleries)
                .where(sql`${galleries.updatedAt} >= ${sevenDaysAgo}`);

            // Fast database-backed estimation: 5.5MB per photo record in DB (original + preview + thumbnail)
            const storageUsedBytes = (photosCountResult?.count || 0) * 5.5 * 1024 * 1024;

            return c.json(
                apiResponse.success({
                    stats: {
                        totalUsers: usersCountResult?.count || 0,
                        totalGalleries: galleriesCountResult?.count || 0,
                        totalPhotos: photosCountResult?.count || 0,
                        totalViews: Number(viewsSumResult?.totalViews || 0),
                        storageUsedBytes,
                        activeUsersCount: Number(activeUsersResult?.count || 0),
                        newSignupsCount: newSignupsResult?.count || 0,
                    },
                }),
                200
            );
        } catch (err: any) {
            console.error("[Admin Stats] Failed to build summaries:", err);
            return c.json(apiResponse.error("Internal Server Error"), 500);
        }
    })
    .openapi(getAdminGalleriesRoute, async (c) => {
        const { limit: queryLimit, offset: queryOffset, search } = c.req.valid("query");
        const limitVal = parseInt(queryLimit) || 10;
        const offsetVal = parseInt(queryOffset) || 0;

        try {
            // Base filters for searching
            let whereClause = undefined;
            if (search) {
                const searchPattern = `%${search}%`;
                whereClause = or(
                    like(galleries.title, searchPattern),
                    like(galleries.clientEmail, searchPattern),
                    like(user.name, searchPattern),
                    like(user.email, searchPattern)
                );
            }

            // Query global galleries list joining user and photos to get counts in a single query
            const listQuery = db
                .select({
                    id: galleries.id,
                    title: galleries.title,
                    clientEmail: galleries.clientEmail,
                    status: galleries.status,
                    accessMode: galleries.accessMode,
                    views: galleries.views,
                    createdAt: galleries.createdAt,
                    owner: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                    },
                    photoCount: count(photos.id),
                })
                .from(galleries)
                .innerJoin(user, eq(galleries.userId, user.id))
                .leftJoin(photos, eq(photos.galleryId, galleries.id))
                .groupBy(galleries.id, user.id);

            if (whereClause) {
                listQuery.where(whereClause);
            }

            const rawGalleries = await listQuery
                .orderBy(desc(galleries.createdAt))
                .limit(limitVal)
                .offset(offsetVal);

            const galleriesWithPhotoCount = rawGalleries.map((row) => ({
                id: row.id,
                title: row.title,
                clientEmail: row.clientEmail,
                status: row.status,
                accessMode: row.accessMode,
                views: row.views,
                createdAt: row.createdAt.toISOString(),
                user: row.owner,
                photoCount: Number(row.photoCount),
            }));

            // Total count for pagination
            const countQuery = db
                .select({ count: count() })
                .from(galleries)
                .innerJoin(user, eq(galleries.userId, user.id));

            if (whereClause) {
                countQuery.where(whereClause);
            }
            const [totalCountResult] = await countQuery;

            return c.json(
                apiResponse.success({
                    galleries: galleriesWithPhotoCount,
                    total: totalCountResult?.count || 0,
                }),
                200
            );
        } catch (err: any) {
            console.error("[Admin Galleries] List failed:", err);
            return c.json(apiResponse.error("Internal Server Error"), 500);
        }
    })
    .openapi(updateAdminGalleryStatusRoute, async (c) => {
        const { id } = c.req.valid("param");
        const { status } = c.req.valid("json");

        try {
            await db
                .update(galleries)
                .set({
                    status,
                    updatedAt: new Date(),
                })
                .where(eq(galleries.id, id));

            return c.json(apiResponse.success({ success: true }), 200);
        } catch (err: any) {
            console.error("[Admin Gallery Status] Override failed:", err);
            return c.json(apiResponse.error("Internal Server Error"), 500);
        }
    })
    .openapi(deleteAdminGalleryRoute, async (c) => {
        const { id: galleryId } = c.req.valid("param");

        try {
            // Find all gallery photos for storage cleanup
            const galleryPhotos = await db
                .select({
                    originalS3Key: photos.originalS3Key,
                    thumbnailS3Key: photos.thumbnailS3Key,
                    watermarkS3Key: photos.watermarkS3Key,
                })
                .from(photos)
                .where(eq(photos.galleryId, galleryId));

            // Perform cascades in DB relational order
            await db.delete(photos).where(eq(photos.galleryId, galleryId));
            await db.delete(galleries).where(eq(galleries.id, galleryId));

            // Asynchronously purge physical binary resources from S3 in background thread
            Promise.all(
                galleryPhotos.flatMap((photo) => {
                    const tasks: Promise<any>[] = [];
                    if (photo.originalS3Key) tasks.push(s3.file(photo.originalS3Key).delete().catch(() => {}));
                    if (photo.thumbnailS3Key) tasks.push(s3.file(photo.thumbnailS3Key).delete().catch(() => {}));
                    if (photo.watermarkS3Key) tasks.push(s3.file(photo.watermarkS3Key).delete().catch(() => {}));
                    return tasks;
                })
            ).catch((err) => console.error("[Admin Cascade Cleanup] S3 deletion errors:", err));

            return c.json(apiResponse.success({ success: true }), 200);
        } catch (err: any) {
            console.error("[Admin Gallery Delete] Cascade failed:", err);
            return c.json(apiResponse.error("Internal Server Error"), 500);
        }
    })
    .openapi(getAdminJobsStatusRoute, async (c) => {
        try {
            const queuesList = [
                { queue: photoQueue, name: "photo-processing" },
                { queue: notificationQueue, name: "notifications" },
                { queue: cleanupQueue, name: "cleanup" },
                { queue: deliveryQueue, name: "delivery" },
            ];

            const queues = await Promise.all(
                queuesList.map(q => getQueueStats(q.queue, q.name))
            );

            const failedJobsNested = await Promise.all(
                queuesList.map(q => getFailedJobs(q.queue, q.name))
            );

            const failedJobs = failedJobsNested
                .flat()
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, 50);

            return c.json(
                apiResponse.success({
                    queues,
                    failedJobs,
                }),
                200
            );
        } catch (err: any) {
            console.error("[Admin Jobs Stats] Failed:", err);
            return c.json(apiResponse.error("Internal Server Error"), 500);
        }
    })
    .openapi(retryAdminJobRoute, async (c) => {
        const { queue: queueName, id } = c.req.valid("param");
        const queue = getQueueByName(queueName);
        if (!queue) {
            return c.json(apiResponse.error("Queue not found"), 404);
        }

        try {
            const job = await queue.getJob(id);
            if (!job) {
                return c.json(apiResponse.error("Job not found"), 404);
            }

            await job.retry();
            return c.json(apiResponse.success({ success: true }), 200);
        } catch (err: any) {
            console.error("[Admin Job Retry] Failed:", err);
            return c.json(apiResponse.error("Internal Server Error"), 500);
        }
    })
    .openapi(retryAllAdminJobsRoute, async (c) => {
        const { queue: queueName } = c.req.valid("param");
        const queue = getQueueByName(queueName);
        if (!queue) {
            return c.json(apiResponse.error("Queue not found"), 404);
        }

        try {
            const failedJobs = await queue.getFailed();
            await Promise.all(failedJobs.map(job => job.retry().catch(() => {})));
            return c.json(apiResponse.success({ success: true, count: failedJobs.length }), 200);
        } catch (err: any) {
            console.error("[Admin Job Retry All] Failed:", err);
            return c.json(apiResponse.error("Internal Server Error"), 500);
        }
    })
    .openapi(deleteAdminJobRoute, async (c) => {
        const { queue: queueName, id } = c.req.valid("param");
        const queue = getQueueByName(queueName);
        if (!queue) {
            return c.json(apiResponse.error("Queue not found"), 404);
        }

        try {
            const job = await queue.getJob(id);
            if (!job) {
                return c.json(apiResponse.error("Job not found"), 404);
            }

            await job.remove();
            return c.json(apiResponse.success({ success: true }), 200);
        } catch (err: any) {
            console.error("[Admin Job Remove] Failed:", err);
            return c.json(apiResponse.error("Internal Server Error"), 500);
        }
    })
    .openapi(purgeAllFailedAdminJobsRoute, async (c) => {
        const { queue: queueName } = c.req.valid("param");
        const queue = getQueueByName(queueName);
        if (!queue) {
            return c.json(apiResponse.error("Queue not found"), 404);
        }

        try {
            const failedJobs = await queue.getFailed();
            const count = failedJobs.length;
            await Promise.all(failedJobs.map(job => job.remove().catch(() => {})));
            return c.json(apiResponse.success({ success: true, count }), 200);
        } catch (err: any) {
            console.error("[Admin Job Purge Failed] Failed:", err);
            return c.json(apiResponse.error("Internal Server Error"), 500);
        }
    });

export type AppType = typeof routes;
export default routes;
