ALTER TABLE "listings" ADD COLUMN "is_archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "listings_archived_idx" ON "listings" USING btree ("is_archived","archived_at");--> statement-breakpoint
CREATE INDEX "listings_make_model_archived_idx" ON "listings" USING btree ("make","model","is_archived");