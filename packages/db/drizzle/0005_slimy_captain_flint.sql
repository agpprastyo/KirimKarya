ALTER TABLE "user" ADD COLUMN "watermark_type" text DEFAULT 'TEXT' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "watermark_text" text DEFAULT 'Kirim Karya' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "watermark_image_key" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "watermark_opacity" integer DEFAULT 30 NOT NULL;