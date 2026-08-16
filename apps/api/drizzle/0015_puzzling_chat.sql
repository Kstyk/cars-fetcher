ALTER TYPE "public"."notification_channel" ADD VALUE 'telegram';--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "telegram_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "telegram_chat_id" varchar(64);--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "telegram_username" varchar(64);--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "telegram_link_token" varchar(64);--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "telegram_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "telegram_error" text;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_telegram_link_token_unique" ON "notification_preferences" USING btree ("telegram_link_token");