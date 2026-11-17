CREATE TYPE "public"."alert_cabin" AS ENUM('qualquer', 'economica', 'executiva');--> statement-breakpoint
CREATE TYPE "public"."alert_date_mode" AS ENUM('qualquer', 'prox30', 'prox90', 'mes', 'datas');--> statement-breakpoint
CREATE TYPE "public"."alert_pay" AS ENUM('qualquer', 'milhas', 'dinheiro');--> statement-breakpoint
CREATE TYPE "public"."deal_kind" AS ENUM('milhas', 'dinheiro');--> statement-breakpoint
CREATE TABLE "flight_deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"origin" text NOT NULL,
	"destination" text NOT NULL,
	"kind" "deal_kind" NOT NULL,
	"program_slug" text,
	"program_name" text,
	"airline" text,
	"cabin" "cabin_class",
	"miles" integer,
	"taxes_brl" numeric(10, 2),
	"cash_brl" numeric(12, 2),
	"round_trip" boolean DEFAULT false NOT NULL,
	"date_from" date,
	"date_to" date,
	"seats" smallint,
	"notes" text,
	"published_on" date,
	"source_url" text NOT NULL,
	"source_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flight_deals_iata_chk" CHECK ("flight_deals"."origin" ~ '^[A-Z]{3}$' and "flight_deals"."destination" ~ '^[A-Z]{3}$'),
	CONSTRAINT "flight_deals_kind_chk" CHECK (("flight_deals"."kind" = 'milhas' and "flight_deals"."miles" > 0) or ("flight_deals"."kind" = 'dinheiro' and "flight_deals"."cash_brl" > 0)),
	CONSTRAINT "flight_deals_source_chk" CHECK ("flight_deals"."source_url" ~* '^https?://')
);
--> statement-breakpoint
CREATE TABLE "flight_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "radar_run_status" DEFAULT 'executando' NOT NULL,
	"summary" text,
	"error" text,
	"found" integer DEFAULT 0 NOT NULL,
	"web_searches" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "route_alert_hits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "route_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"origin_places" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"destination_places" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"origin_codes" text[] DEFAULT '{}'::text[] NOT NULL,
	"destination_codes" text[] DEFAULT '{}'::text[] NOT NULL,
	"date_mode" "alert_date_mode" DEFAULT 'qualquer' NOT NULL,
	"month" text,
	"date_from" date,
	"date_to" date,
	"cabin" "alert_cabin" DEFAULT 'qualquer' NOT NULL,
	"pay" "alert_pay" DEFAULT 'qualquer' NOT NULL,
	"max_miles" integer,
	"max_cash_brl" numeric(12, 2),
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "route_alerts_month_chk" CHECK ("route_alerts"."month" is null or "route_alerts"."month" ~ '^[0-9]{4}-[0-9]{2}$'),
	CONSTRAINT "route_alerts_dates_chk" CHECK ("route_alerts"."date_from" is null or "route_alerts"."date_to" is null or "route_alerts"."date_from" <= "route_alerts"."date_to"),
	CONSTRAINT "route_alerts_caps_chk" CHECK (("route_alerts"."max_miles" is null or "route_alerts"."max_miles" > 0) and ("route_alerts"."max_cash_brl" is null or "route_alerts"."max_cash_brl" > 0))
);
--> statement-breakpoint
ALTER TABLE "flight_deals" ADD CONSTRAINT "flight_deals_run_id_flight_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."flight_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flight_deals" ADD CONSTRAINT "flight_deals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flight_runs" ADD CONSTRAINT "flight_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_alert_hits" ADD CONSTRAINT "route_alert_hits_alert_id_route_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."route_alerts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_alert_hits" ADD CONSTRAINT "route_alert_hits_deal_id_flight_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."flight_deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_alert_hits" ADD CONSTRAINT "route_alert_hits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_alerts" ADD CONSTRAINT "route_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "flight_deals_user_idx" ON "flight_deals" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "flight_runs_user_idx" ON "flight_runs" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "route_alert_hits_uq" ON "route_alert_hits" USING btree ("alert_id","deal_id");--> statement-breakpoint
CREATE INDEX "route_alert_hits_user_idx" ON "route_alert_hits" USING btree ("user_id","seen_at");--> statement-breakpoint
CREATE INDEX "route_alerts_user_idx" ON "route_alerts" USING btree ("user_id");