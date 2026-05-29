ALTER TABLE "galleries" ADD COLUMN "selection_limit" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "galleries" ADD COLUMN "price_per_extra_photo" integer DEFAULT 0 NOT NULL;