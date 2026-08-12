ALTER TABLE "listing_matches" DROP CONSTRAINT "listing_matches_filter_id_filters_id_fk";
--> statement-breakpoint
ALTER TABLE "listing_matches" ALTER COLUMN "filter_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "listing_matches" ADD CONSTRAINT "listing_matches_filter_id_filters_id_fk" FOREIGN KEY ("filter_id") REFERENCES "public"."filters"("id") ON DELETE set null ON UPDATE no action;