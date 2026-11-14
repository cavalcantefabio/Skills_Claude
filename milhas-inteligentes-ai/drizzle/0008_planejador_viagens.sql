CREATE TYPE "public"."quote_certainty" AS ENUM('real', 'estimativa');--> statement-breakpoint
CREATE TYPE "public"."quote_kind" AS ENUM('milhas', 'dinheiro');--> statement-breakpoint
CREATE TYPE "public"."trip_type" AS ENUM('ida_volta', 'ida');--> statement-breakpoint
CREATE TABLE "trip_accounts" (
	"trip_id" uuid NOT NULL,
	"account_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "quote_kind" NOT NULL,
	"certainty" "quote_certainty" NOT NULL,
	"program_id" uuid,
	"label" text,
	"miles_per_pax" integer,
	"taxes_per_pax_brl" numeric(10, 2),
	"cash_per_pax_brl" numeric(12, 2),
	"covers" "trip_type" DEFAULT 'ida_volta' NOT NULL,
	"source_url" text,
	"checked_on" date NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_quotes_kind_chk" CHECK (("trip_quotes"."kind" = 'milhas' and "trip_quotes"."program_id" is not null and "trip_quotes"."miles_per_pax" > 0)
        or ("trip_quotes"."kind" = 'dinheiro' and "trip_quotes"."cash_per_pax_brl" > 0)),
	CONSTRAINT "trip_quotes_taxes_chk" CHECK ("trip_quotes"."taxes_per_pax_brl" is null or "trip_quotes"."taxes_per_pax_brl" >= 0),
	CONSTRAINT "trip_quotes_source_chk" CHECK ("trip_quotes"."source_url" is null or "trip_quotes"."source_url" ~* '^https?://')
);
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "trip_type" "trip_type" DEFAULT 'ida_volta' NOT NULL;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "flex_days" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "budget_brl" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "alert_days_before" smallint DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "watch_promotions" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "trip_accounts" ADD CONSTRAINT "trip_accounts_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_accounts" ADD CONSTRAINT "trip_accounts_account_id_loyalty_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."loyalty_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_quotes" ADD CONSTRAINT "trip_quotes_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_quotes" ADD CONSTRAINT "trip_quotes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_quotes" ADD CONSTRAINT "trip_quotes_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trip_accounts_pk" ON "trip_accounts" USING btree ("trip_id","account_id");--> statement-breakpoint
CREATE INDEX "trip_quotes_trip_idx" ON "trip_quotes" USING btree ("trip_id");--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_flex_chk" CHECK ("trips"."flex_days" between 0 and 30);--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_budget_chk" CHECK ("trips"."budget_brl" is null or "trips"."budget_brl" >= 0);--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_alert_chk" CHECK ("trips"."alert_days_before" between 0 and 365);