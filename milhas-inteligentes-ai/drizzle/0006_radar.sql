CREATE TYPE "public"."opportunity_kind" AS ENUM('transferencia', 'compra', 'outra');--> statement-breakpoint
CREATE TYPE "public"."radar_run_status" AS ENUM('executando', 'concluida', 'falhou');--> statement-breakpoint
CREATE TABLE "radar_opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "opportunity_kind" NOT NULL,
	"title" text NOT NULL,
	"from_slug" text,
	"from_name" text,
	"to_slug" text,
	"to_name" text,
	"bonus_pct" numeric(7, 2),
	"ratio_from" numeric(8, 2),
	"ratio_to" numeric(8, 2),
	"discount_pct" numeric(7, 2),
	"price_per_thousand_brl" numeric(10, 2),
	"starts_on" date,
	"ends_on" date,
	"conditions" text,
	"source_url" text NOT NULL,
	"source_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "radar_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "radar_run_status" DEFAULT 'executando' NOT NULL,
	"summary" text,
	"error" text,
	"web_searches" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "agent_usage" ADD COLUMN "web_searches" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_usage" ADD COLUMN "source" text DEFAULT 'agente' NOT NULL;--> statement-breakpoint
ALTER TABLE "radar_opportunities" ADD CONSTRAINT "radar_opportunities_run_id_radar_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."radar_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radar_opportunities" ADD CONSTRAINT "radar_opportunities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radar_runs" ADD CONSTRAINT "radar_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "radar_opp_run_idx" ON "radar_opportunities" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "radar_opp_user_idx" ON "radar_opportunities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "radar_runs_user_idx" ON "radar_runs" USING btree ("user_id","started_at");