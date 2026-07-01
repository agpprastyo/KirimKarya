import { db } from "../db";
import { photos } from "../schema";
import { eq } from "drizzle-orm";

export class PhotoRepository {
    async findById(id: string) {
        const [photo] = await db.select().from(photos).where(eq(photos.id, id));
        return photo || null;
    }

    async create(values: typeof photos.$inferInsert, tx: any = db) {
        const [inserted] = await tx.insert(photos).values(values).returning();
        return inserted;
    }

    async update(id: string, values: Partial<typeof photos.$inferInsert>, tx: any = db) {
        const [updated] = await tx.update(photos).set(values).where(eq(photos.id, id)).returning();
        return updated;
    }

    async delete(id: string, tx: any = db) {
        const [deleted] = await tx.delete(photos).where(eq(photos.id, id)).returning();
        return deleted;
    }

    async listByGalleryId(galleryId: string) {
        return await db.select().from(photos).where(eq(photos.galleryId, galleryId));
    }
}

export const photoRepository = new PhotoRepository();

