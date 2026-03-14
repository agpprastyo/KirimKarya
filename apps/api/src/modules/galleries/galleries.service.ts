import { db } from "@kirimkarya/db";
import { galleries } from "@kirimkarya/db";
import { eq, and } from "drizzle-orm";

export class GalleryService {
    async listByUserId(userId: string) {
        return await db
            .select()
            .from(galleries)
            .where(eq(galleries.userId, userId))
            .orderBy(galleries.createdAt);
    }

    async getById(id: string, userId: string) {
        const [gallery] = await db
            .select()
            .from(galleries)
            .where(and(eq(galleries.id, id), eq(galleries.userId, userId)));
        return gallery;
    }

    async create(userId: string, data: any) {
        let passwordHash = undefined;
        if (data.password) {
            passwordHash = await Bun.password.hash(data.password, {
                algorithm: "bcrypt",
                cost: 10,
            });
        }
       
        const [newGallery] = await db
            .insert(galleries)
            .values({
                userId,
                title: data.title,
                clientEmail: data.clientEmail,
                passwordHash,
                expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
            })
            .returning();
        return newGallery;
    }

    async update(id: string, userId: string, data: any) {
        const [updatedGallery] = await db
            .update(galleries)
            .set({
                ...data,
                expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
                updatedAt: new Date(),
            })
            .where(and(eq(galleries.id, id), eq(galleries.userId, userId)))
            .returning();
        return updatedGallery;
    }

    async delete(id: string, userId: string) {
        const [deletedGallery] = await db
            .delete(galleries)
            .where(and(eq(galleries.id, id), eq(galleries.userId, userId)))
            .returning();
        return deletedGallery;
    }
}

export const galleryService = new GalleryService();
