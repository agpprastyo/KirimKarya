import { db, galleries, photos, feedbacks, eq, sql, desc } from "@kirimkarya/db";

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
}

export const statsService = new StatsService();
