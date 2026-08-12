CREATE TYPE "public"."vehicle_issue_severity" AS ENUM('minor', 'moderate', 'serious');--> statement-breakpoint
CREATE TYPE "public"."vehicle_note_kind" AS ENUM('reputation', 'ownership_cost', 'buying_advice');--> statement-breakpoint
CREATE TYPE "public"."vehicle_source" AS ENUM('manual', 'ai_generated');--> statement-breakpoint
CREATE TABLE "vehicle_engines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" uuid NOT NULL,
	"engine_code" varchar(40),
	"name" varchar(120) NOT NULL,
	"fuel_type" "fuel_type",
	"displacement_cm3" integer,
	"power_hp" integer,
	"torque_nm" integer,
	"gearbox" "gearbox",
	"drive_type" "drive_type",
	"acceleration_0_100" numeric(4, 1),
	"top_speed_kmh" integer,
	"fuel_consumption_combined" numeric(4, 1),
	"year_from" smallint,
	"year_to" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_known_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" uuid NOT NULL,
	"engine_id" uuid,
	"title" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"severity" "vehicle_issue_severity" DEFAULT 'moderate' NOT NULL,
	"mileage_hint" varchar(100),
	"source" "vehicle_source" DEFAULT 'manual' NOT NULL,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"make" varchar(60) NOT NULL,
	"model" varchar(80) NOT NULL,
	"generation" varchar(80) NOT NULL,
	"year_from" smallint,
	"year_to" smallint,
	"body_types" "body_type"[],
	"summary" text,
	"source" "vehicle_source" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" uuid NOT NULL,
	"kind" "vehicle_note_kind" NOT NULL,
	"body" text NOT NULL,
	"source" "vehicle_source" DEFAULT 'manual' NOT NULL,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vehicle_engines" ADD CONSTRAINT "vehicle_engines_model_id_vehicle_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."vehicle_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_known_issues" ADD CONSTRAINT "vehicle_known_issues_model_id_vehicle_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."vehicle_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_known_issues" ADD CONSTRAINT "vehicle_known_issues_engine_id_vehicle_engines_id_fk" FOREIGN KEY ("engine_id") REFERENCES "public"."vehicle_engines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_notes" ADD CONSTRAINT "vehicle_notes_model_id_vehicle_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."vehicle_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vehicle_engines_model_idx" ON "vehicle_engines" USING btree ("model_id");--> statement-breakpoint
CREATE INDEX "vehicle_known_issues_model_idx" ON "vehicle_known_issues" USING btree ("model_id");--> statement-breakpoint
CREATE INDEX "vehicle_known_issues_engine_idx" ON "vehicle_known_issues" USING btree ("engine_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_models_unique" ON "vehicle_models" USING btree ("make","model","generation");--> statement-breakpoint
CREATE INDEX "vehicle_models_make_idx" ON "vehicle_models" USING btree ("make");--> statement-breakpoint
CREATE INDEX "vehicle_notes_model_idx" ON "vehicle_notes" USING btree ("model_id");