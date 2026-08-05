CREATE TYPE "public"."body_type" AS ENUM('sedan', 'hatchback', 'wagon', 'suv', 'coupe', 'convertible', 'minivan', 'pickup', 'van', 'other');--> statement-breakpoint
CREATE TYPE "public"."digest_frequency" AS ENUM('instant', 'hourly', 'daily', 'weekly', 'off');--> statement-breakpoint
CREATE TYPE "public"."drive_type" AS ENUM('fwd', 'rwd', 'awd', 'other');--> statement-breakpoint
CREATE TYPE "public"."fetch_status" AS ENUM('pending', 'running', 'success', 'partial', 'failed');--> statement-breakpoint
CREATE TYPE "public"."fuel_type" AS ENUM('petrol', 'petrol_lpg', 'petrol_cng', 'diesel', 'hybrid', 'plugin_hybrid', 'electric', 'hydrogen', 'other');--> statement-breakpoint
CREATE TYPE "public"."gearbox" AS ENUM('manual', 'automatic', 'semi_automatic', 'other');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('in_app', 'email', 'push');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('new_listing', 'price_drop', 'price_raise', 'listing_removed', 'fetch_failed', 'digest');--> statement-breakpoint
CREATE TYPE "public"."provider" AS ENUM('otomoto', 'olx', 'mobile_de', 'autoscout24');--> statement-breakpoint
CREATE TYPE "public"."seller_type" AS ENUM('private', 'dealer', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."vehicle_condition" AS ENUM('new', 'used', 'damaged');--> statement-breakpoint
CREATE TABLE "favorites" (
	"user_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"note" text,
	"rating" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_user_id_listing_id_pk" PRIMARY KEY("user_id","listing_id")
);
--> statement-breakpoint
CREATE TABLE "fetch_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "provider" NOT NULL,
	"group_id" uuid,
	"filter_id" uuid,
	"status" "fetch_status" DEFAULT 'pending' NOT NULL,
	"trigger" varchar(20) DEFAULT 'manual' NOT NULL,
	"pages_fetched" integer DEFAULT 0 NOT NULL,
	"items_seen" integer DEFAULT 0 NOT NULL,
	"items_new" integer DEFAULT 0 NOT NULL,
	"items_updated" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"duration_ms" integer
);
--> statement-breakpoint
CREATE TABLE "filter_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"color" varchar(20),
	"icon" varchar(40),
	"is_active" boolean DEFAULT true NOT NULL,
	"notify_on_new" boolean DEFAULT true NOT NULL,
	"refresh_interval_minutes" integer DEFAULT 60 NOT NULL,
	"last_fetched_at" timestamp with time zone,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "filters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"provider" "provider" DEFAULT 'otomoto' NOT NULL,
	"name" varchar(120),
	"is_active" boolean DEFAULT true NOT NULL,
	"make" varchar(60),
	"model" varchar(80),
	"generation" varchar(80),
	"version" varchar(120),
	"query" varchar(200),
	"year_from" smallint,
	"year_to" smallint,
	"price_from" numeric(12, 2),
	"price_to" numeric(12, 2),
	"currency" varchar(3) DEFAULT 'PLN' NOT NULL,
	"mileage_from" integer,
	"mileage_to" integer,
	"engine_power_from" integer,
	"engine_power_to" integer,
	"engine_capacity_from" integer,
	"engine_capacity_to" integer,
	"fuel_types" "fuel_type"[],
	"gearboxes" "gearbox"[],
	"body_types" "body_type"[],
	"drive_types" "drive_type"[],
	"condition" "vehicle_condition",
	"seller_type" "seller_type",
	"exclude_damaged" boolean DEFAULT false NOT NULL,
	"only_with_photos" boolean DEFAULT false NOT NULL,
	"registered_in_pl" boolean,
	"first_owner" boolean,
	"country_origin" varchar(60),
	"region" varchar(80),
	"city" varchar(120),
	"radius_km" integer,
	"extra_params" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"filter_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"rank" integer,
	"first_matched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_matched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "listing_price_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"delta_amount" numeric(12, 2),
	"delta_pct" numeric(7, 3),
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "provider" NOT NULL,
	"external_id" varchar(120) NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"make" varchar(60),
	"model" varchar(80),
	"generation" varchar(80),
	"version" varchar(120),
	"price" numeric(12, 2),
	"currency" varchar(3) DEFAULT 'PLN' NOT NULL,
	"price_gross" boolean,
	"has_vat_invoice" boolean,
	"year" smallint,
	"mileage_km" integer,
	"fuel_type" "fuel_type",
	"gearbox" "gearbox",
	"body_type" "body_type",
	"drive_type" "drive_type",
	"engine_capacity_cm3" integer,
	"engine_power_hp" integer,
	"doors" smallint,
	"seats" smallint,
	"color" varchar(40),
	"condition" "vehicle_condition",
	"is_damaged" boolean,
	"vin" varchar(32),
	"first_registration_date" timestamp with time zone,
	"country_origin" varchar(60),
	"seller_type" "seller_type" DEFAULT 'unknown' NOT NULL,
	"seller_name" varchar(200),
	"city" varchar(120),
	"region" varchar(80),
	"country" varchar(60),
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"thumbnail_url" text,
	"images_count" smallint,
	"published_at" timestamp with time zone,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"deactivated_at" timestamp with time zone,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"push_enabled" boolean DEFAULT false NOT NULL,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"notify_new_listing" boolean DEFAULT true NOT NULL,
	"notify_price_drop" boolean DEFAULT true NOT NULL,
	"notify_listing_removed" boolean DEFAULT false NOT NULL,
	"notify_fetch_failed" boolean DEFAULT false NOT NULL,
	"price_drop_threshold_pct" numeric(5, 2) DEFAULT 1 NOT NULL,
	"digest_frequency" "digest_frequency" DEFAULT 'daily' NOT NULL,
	"quiet_hours_start" smallint,
	"quiet_hours_end" smallint,
	"timezone" varchar(64) DEFAULT 'Europe/Warsaw' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"channel" "notification_channel" DEFAULT 'in_app' NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text,
	"listing_id" uuid,
	"group_id" uuid,
	"payload" jsonb,
	"read_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_tokens" (
	"provider" "provider" PRIMARY KEY NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"token_type" varchar(20) DEFAULT 'Bearer' NOT NULL,
	"scope" text,
	"expires_at" timestamp with time zone NOT NULL,
	"obtained_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"replaced_by_token_id" uuid,
	"user_agent" text,
	"ip_address" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"password_hash" text NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"email_verified_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fetch_runs" ADD CONSTRAINT "fetch_runs_group_id_filter_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."filter_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fetch_runs" ADD CONSTRAINT "fetch_runs_filter_id_filters_id_fk" FOREIGN KEY ("filter_id") REFERENCES "public"."filters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filter_groups" ADD CONSTRAINT "filter_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filters" ADD CONSTRAINT "filters_group_id_filter_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."filter_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_matches" ADD CONSTRAINT "listing_matches_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_matches" ADD CONSTRAINT "listing_matches_filter_id_filters_id_fk" FOREIGN KEY ("filter_id") REFERENCES "public"."filters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_matches" ADD CONSTRAINT "listing_matches_group_id_filter_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."filter_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_price_history" ADD CONSTRAINT "listing_price_history_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_group_id_filter_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."filter_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "favorites_user_idx" ON "favorites" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "fetch_runs_group_idx" ON "fetch_runs" USING btree ("group_id","started_at");--> statement-breakpoint
CREATE INDEX "fetch_runs_status_idx" ON "fetch_runs" USING btree ("status","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "filter_groups_user_name_unique" ON "filter_groups" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "filter_groups_active_idx" ON "filter_groups" USING btree ("is_active","last_fetched_at");--> statement-breakpoint
CREATE INDEX "filters_group_idx" ON "filters" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "filters_provider_idx" ON "filters" USING btree ("provider","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "listing_matches_listing_filter_unique" ON "listing_matches" USING btree ("listing_id","filter_id");--> statement-breakpoint
CREATE INDEX "listing_matches_group_idx" ON "listing_matches" USING btree ("group_id","first_matched_at");--> statement-breakpoint
CREATE INDEX "listing_price_history_listing_idx" ON "listing_price_history" USING btree ("listing_id","recorded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "listings_provider_external_unique" ON "listings" USING btree ("provider","external_id");--> statement-breakpoint
CREATE INDEX "listings_make_model_idx" ON "listings" USING btree ("make","model");--> statement-breakpoint
CREATE INDEX "listings_price_idx" ON "listings" USING btree ("price");--> statement-breakpoint
CREATE INDEX "listings_year_idx" ON "listings" USING btree ("year");--> statement-breakpoint
CREATE INDEX "listings_last_seen_idx" ON "listings" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "listings_active_idx" ON "listings" USING btree ("is_active","published_at");--> statement-breakpoint
CREATE INDEX "notifications_user_unread_idx" ON "notifications" USING btree ("user_id","read_at","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscriptions_endpoint_unique" ON "push_subscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_tokens_hash_unique" ON "refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_unique" ON "users" USING btree (lower("email"));