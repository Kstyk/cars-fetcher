ALTER TABLE "filters" ADD COLUMN "colors" text[];--> statement-breakpoint
ALTER TABLE "filters" ADD COLUMN "door_counts" smallint[];--> statement-breakpoint
ALTER TABLE "filters" ADD COLUMN "seat_counts" smallint[];--> statement-breakpoint
ALTER TABLE "filters" ADD COLUMN "no_accident" boolean;--> statement-breakpoint
ALTER TABLE "filters" ADD COLUMN "serviced_at_aso" boolean;--> statement-breakpoint
ALTER TABLE "filters" ADD COLUMN "has_vin" boolean;--> statement-breakpoint
ALTER TABLE "filters" ADD COLUMN "vat_invoice" boolean;--> statement-breakpoint
ALTER TABLE "filters" ADD COLUMN "equipment" text[];