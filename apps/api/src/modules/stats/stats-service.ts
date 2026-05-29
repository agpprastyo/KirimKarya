import { db, galleries, photos, feedbacks, galleryAccess, eq, sql, desc, and, gte } from "@kirimkarya/db";

export class StatsService {
    async getSummary(userId: string) {
        const [counts] = await db
            .select({
                totalGalleries: sql<number>`count(distinct ${galleries.id})`,
                totalPhotos: sql<number>`count(distinct ${photos.id})`,
                totalViews: sql<number>`sum(${galleries.views})`,
                totalSelections: sql<number>`count(distinct ${feedbacks.id}) filter (where ${feedbacks.isSelected} = true)`,
            })
            .from(galleries)
            .leftJoin(photos, eq(galleries.id, photos.galleryId))
            .leftJoin(feedbacks, eq(photos.id, feedbacks.photoId))
            .where(eq(galleries.userId, userId));


        const topGalleries = await db
            .select({
                id: galleries.id,
                title: galleries.title,
                views: galleries.views,
            })
            .from(galleries)
            .where(eq(galleries.userId, userId))
            .orderBy(desc(galleries.views))
            .limit(5);

        const recentActivity = await db
            .select({
                id: feedbacks.id,
                galleryTitle: galleries.title,
                galleryId: galleries.id,
                photoId: photos.id,
                type: sql<string>`case when ${feedbacks.comment} is not null then 'COMMENT' else 'SELECTION' end`,
                createdAt: feedbacks.createdAt,
                clientIdentifier: feedbacks.clientIdentifier,
            })
            .from(feedbacks)
            .innerJoin(photos, eq(feedbacks.photoId, photos.id))
            .innerJoin(galleries, eq(photos.galleryId, galleries.id))
            .where(eq(galleries.userId, userId))
            .orderBy(desc(feedbacks.createdAt))
            .limit(5);

        return {
            stats: {
                totalGalleries: Number(counts?.totalGalleries || 0),
                totalPhotos: Number(counts?.totalPhotos || 0),
                totalViews: Number(counts?.totalViews || 0),
                totalSelections: Number(counts?.totalSelections || 0),
            },
            topGalleries,
            recentActivity,
        };
    }

    async getInsights(userId: string) {
        // 30-day window start
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Funnel: total views, total unique selecting clients, total selections, delivered count
        const [funnel] = await db
            .select({
                totalViews: sql<number>`sum(${galleries.views})`,
                totalPhotos: sql<number>`count(distinct ${photos.id})`,
                totalSelections: sql<number>`count(distinct ${feedbacks.id}) filter (where ${feedbacks.isSelected} = true)`,
                totalDelivered: sql<number>`count(distinct ${galleries.id}) filter (where ${galleries.deliveryStatus} = 'COMPLETED')`,
                totalGalleries: sql<number>`count(distinct ${galleries.id})`,
            })
            .from(galleries)
            .leftJoin(photos, eq(galleries.id, photos.galleryId))
            .leftJoin(feedbacks, eq(photos.id, feedbacks.photoId))
            .where(eq(galleries.userId, userId));

        // Daily view trend: last 30 days using gallery createdAt as proxy for activity
        // Since we track views on galleries, we approximate daily data via feedback createdAt distribution
        const dailyFeedbacks = await db
            .select({
                date: sql<string>`to_char(${feedbacks.createdAt}, 'YYYY-MM-DD')`,
                count: sql<number>`count(*)`,
                selections: sql<number>`count(*) filter (where ${feedbacks.isSelected} = true)`,
            })
            .from(feedbacks)
            .innerJoin(photos, eq(feedbacks.photoId, photos.id))
            .innerJoin(galleries, eq(photos.galleryId, galleries.id))
            .where(and(
                eq(galleries.userId, userId),
                gte(feedbacks.createdAt, thirtyDaysAgo)
            ))
            .groupBy(sql`to_char(${feedbacks.createdAt}, 'YYYY-MM-DD')`)
            .orderBy(sql`to_char(${feedbacks.createdAt}, 'YYYY-MM-DD')`);

        // Top clients: by selection activity across all galleries
        const topClients = await db
            .select({
                clientIdentifier: feedbacks.clientIdentifier,
                totalSelections: sql<number>`count(*) filter (where ${feedbacks.isSelected} = true)`,
                totalComments: sql<number>`count(*) filter (where ${feedbacks.comment} is not null)`,
                totalActivity: sql<number>`count(*)`,
                galleryTitle: galleries.title,
                galleryId: galleries.id,
                clientEmail: galleries.clientEmail,
                lastActivity: sql<string>`max(${feedbacks.updatedAt})`,
            })
            .from(feedbacks)
            .innerJoin(photos, eq(feedbacks.photoId, photos.id))
            .innerJoin(galleries, eq(photos.galleryId, galleries.id))
            .where(eq(galleries.userId, userId))
            .groupBy(feedbacks.clientIdentifier, galleries.title, galleries.id, galleries.clientEmail)
            .orderBy(desc(sql`count(*)`))
            .limit(10);

        // Per-gallery mini funnel for the top 5 galleries
        const galleryFunnels = await db
            .select({
                id: galleries.id,
                title: galleries.title,
                views: galleries.views,
                totalPhotos: sql<number>`count(distinct ${photos.id})`,
                selections: sql<number>`count(distinct ${feedbacks.id}) filter (where ${feedbacks.isSelected} = true)`,
                delivered: sql<number>`case when ${galleries.deliveryStatus} = 'COMPLETED' then 1 else 0 end`,
            })
            .from(galleries)
            .leftJoin(photos, eq(galleries.id, photos.galleryId))
            .leftJoin(feedbacks, eq(photos.id, feedbacks.photoId))
            .where(eq(galleries.userId, userId))
            .groupBy(galleries.id, galleries.title, galleries.views, galleries.deliveryStatus)
            .orderBy(desc(galleries.views))
            .limit(5);

        return {
            funnel: {
                totalViews: Number(funnel?.totalViews || 0),
                totalPhotos: Number(funnel?.totalPhotos || 0),
                totalSelections: Number(funnel?.totalSelections || 0),
                totalDelivered: Number(funnel?.totalDelivered || 0),
                totalGalleries: Number(funnel?.totalGalleries || 0),
            },
            dailyActivity: dailyFeedbacks.map(d => ({
                date: d.date,
                count: Number(d.count),
                selections: Number(d.selections),
            })),
            topClients: topClients.map(c => ({
                clientIdentifier: c.clientIdentifier,
                totalSelections: Number(c.totalSelections),
                totalComments: Number(c.totalComments),
                totalActivity: Number(c.totalActivity),
                galleryTitle: c.galleryTitle,
                galleryId: c.galleryId,
                clientEmail: c.clientEmail,
                lastActivity: c.lastActivity,
            })),
            galleryFunnels: galleryFunnels.map(g => ({
                id: g.id,
                title: g.title,
                views: g.views,
                totalPhotos: Number(g.totalPhotos),
                selections: Number(g.selections),
                delivered: Number(g.delivered),
            })),
        };
    }

    async getAllClients(userId: string) {
        // Get all unique clients across all galleries for this photographer
        const clients = await db
            .select({
                clientIdentifier: feedbacks.clientIdentifier,
                galleryId: galleries.id,
                galleryTitle: galleries.title,
                clientEmail: galleries.clientEmail,
                deliveryStatus: galleries.deliveryStatus,
                totalSelections: sql<number>`count(*) filter (where ${feedbacks.isSelected} = true)`,
                totalComments: sql<number>`count(*) filter (where ${feedbacks.comment} is not null)`,
                lastActivity: sql<string>`max(${feedbacks.updatedAt})`,
            })
            .from(feedbacks)
            .innerJoin(photos, eq(feedbacks.photoId, photos.id))
            .innerJoin(galleries, eq(photos.galleryId, galleries.id))
            .where(eq(galleries.userId, userId))
            .groupBy(
                feedbacks.clientIdentifier,
                galleries.id,
                galleries.title,
                galleries.clientEmail,
                galleries.deliveryStatus
            )
            .orderBy(desc(sql`max(${feedbacks.updatedAt})`));

        return clients.map(c => ({
            clientIdentifier: c.clientIdentifier,
            galleryId: c.galleryId,
            galleryTitle: c.galleryTitle,
            clientEmail: c.clientEmail,
            deliveryStatus: c.deliveryStatus,
            totalSelections: Number(c.totalSelections),
            totalComments: Number(c.totalComments),
            lastActivity: c.lastActivity,
        }));
    }
}

export const statsService = new StatsService();
