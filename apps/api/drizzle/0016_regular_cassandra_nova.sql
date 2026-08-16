ALTER TYPE "public"."notification_type" ADD VALUE 'good_deal' BEFORE 'price_drop';--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "notify_good_deal" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "good_deal_threshold_pct" numeric(5, 2) DEFAULT 15 NOT NULL;