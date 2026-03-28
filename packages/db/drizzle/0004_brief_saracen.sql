ALTER TABLE "galleries" ADD COLUMN "access_mode" varchar(50) DEFAULT 'OTP' NOT NULL;--> statement-breakpoint
ALTER TABLE "galleries" ADD COLUMN "delivery_zip_key" varchar(1024);--> statement-breakpoint
ALTER TABLE "galleries" ADD COLUMN "delivery_status" varchar(50) DEFAULT 'IDLE' NOT NULL;--> statement-breakpoint
ALTER TABLE "galleries" ADD COLUMN "delivered_at" timestamp;