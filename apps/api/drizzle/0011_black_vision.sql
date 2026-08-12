ALTER TABLE "listings" ADD COLUMN "merged_into_id" uuid;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_merged_into_id_fk" FOREIGN KEY ("merged_into_id") REFERENCES "public"."listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listings_merged_into_idx" ON "listings" USING btree ("merged_into_id");