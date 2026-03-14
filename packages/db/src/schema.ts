import { pgTable, text, timestamp, boolean, varchar, uuid, integer } from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";
export * from "./auth-schema";
import { user } from "./auth-schema";

// Kirim Karya Domain Tables
export const galleries = pgTable("galleries", {
    id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
    userId: text("user_id").notNull().references(() => user.id),
    title: varchar("title", { length: 255 }).notNull(),
    clientEmail: varchar("client_email", { length: 255 }),
    passwordHash: varchar("password_hash", { length: 255 }),
    status: varchar("status", { length: 50 }).default('DRAFT').notNull(),
    views: integer("views").default(0).notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const photos = pgTable("photos", {
    id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
    galleryId: uuid("gallery_id").notNull().references(() => galleries.id),
    filename: varchar("filename", { length: 255 }).notNull(),
    originalS3Key: varchar("original_s3_key", { length: 1024 }).notNull(),
    thumbnailS3Key: varchar("thumbnail_s3_key", { length: 1024 }),
    watermarkS3Key: varchar("watermark_s3_key", { length: 1024 }),
    status: varchar("status", { length: 50 }).default('PENDING').notNull(),
    uploadedAt: timestamp("uploaded_at", { mode: "date" }).defaultNow().notNull(),
});

export const feedbacks = pgTable("feedbacks", {
    id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
    photoId: uuid("photo_id").notNull().references(() => photos.id),
    isSelected: boolean("is_selected").default(false).notNull(),
    comment: text("comment"),
    clientIdentifier: varchar("client_identifier", { length: 255 }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});
