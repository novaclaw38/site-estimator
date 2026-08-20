CREATE TYPE "public"."job_status" AS ENUM('queued', 'analyzing', 'pricing', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."line_item_category" AS ENUM('core', 'consumable', 'hardware');--> statement-breakpoint
CREATE TYPE "public"."vendor" AS ENUM('builders', 'cashbuild', 'chamberlain', 'brights', 'gelmar');--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"media_keys" text[] NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"category" "line_item_category" NOT NULL,
	"item_name" text NOT NULL,
	"quantity" numeric NOT NULL,
	"unit" text NOT NULL,
	"vendor_name" text,
	"unit_price" numeric DEFAULT '0' NOT NULL,
	"source_note" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"trade" text NOT NULL,
	"job_title" text NOT NULL,
	"scope_of_work" text NOT NULL,
	"hazards_notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_material_cost" numeric DEFAULT '0' NOT NULL,
	"markup_percent" numeric DEFAULT '15' NOT NULL,
	"labor_hours" numeric DEFAULT '0' NOT NULL,
	"hourly_rate" numeric DEFAULT '0' NOT NULL,
	"grand_total" numeric DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'ZAR' NOT NULL,
	"share_token" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "quotes_job_id_unique" UNIQUE("job_id"),
	CONSTRAINT "quotes_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"business_name" text,
	"default_hourly_rate" numeric,
	"default_markup_percent" numeric DEFAULT '15' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_price_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"normalized_item_name" text NOT NULL,
	"vendor" "vendor" NOT NULL,
	"price" numeric NOT NULL,
	"product_url" text NOT NULL,
	"scraped_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_item_idx" ON "vendor_price_cache" USING btree ("normalized_item_name","vendor");