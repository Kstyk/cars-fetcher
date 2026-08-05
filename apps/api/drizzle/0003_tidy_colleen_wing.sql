CREATE TABLE "geo_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city" varchar(120) NOT NULL,
	"region" varchar(80),
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"source" varchar(40) DEFAULT 'nominatim' NOT NULL,
	"resolved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"failed_attempts" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "geo_locations_place_unique" ON "geo_locations" USING btree (lower("city"),coalesce(lower("region"), ''));