ALTER TABLE "notifications" ADD COLUMN "email_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "email_error" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "push_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "push_error" text;