-- Migration 0007: Add indexes, cascade deletes, unique constraint, and fileSize column
-- Addresses Database Review (Section 7) findings

--> statement-breakpoint
-- 1. Add missing indexes on foreign key columns (critical for performance)
CREATE INDEX IF NOT EXISTS "idx_galleries_user_id" ON "galleries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_galleries_expires_at" ON "galleries" USING btree ("expires_at") WHERE "expires_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_photos_gallery_id" ON "photos" USING btree ("gallery_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_feedbacks_photo_id" ON "feedbacks" USING btree ("photo_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_feedbacks_client_identifier" ON "feedbacks" USING btree ("client_identifier");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_gallery_access_gallery_email" ON "gallery_access" USING btree ("gallery_id", "email");--> statement-breakpoint

-- 2. Add unique constraint on feedbacks(photo_id, client_identifier) to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS "idx_feedbacks_photo_client_uniq" ON "feedbacks" USING btree ("photo_id", "client_identifier");--> statement-breakpoint

-- 3. Add fileSize column on photos for accurate storage tracking
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "file_size" bigint;--> statement-breakpoint

-- 4. Fix cascade deletes: galleries -> photos -> feedbacks
-- Drop old FK constraints and re-add with ON DELETE CASCADE
ALTER TABLE "photos" DROP CONSTRAINT IF EXISTS "photos_gallery_id_galleries_id_fk";--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."galleries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "feedbacks" DROP CONSTRAINT IF EXISTS "feedbacks_photo_id_photos_id_fk";--> statement-breakpoint
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "galleries" DROP CONSTRAINT IF EXISTS "galleries_user_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "galleries" ADD CONSTRAINT "galleries_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
