CREATE TYPE "public"."cabin_class" AS ENUM('economica', 'premium', 'executiva', 'primeira');--> statement-breakpoint
CREATE TYPE "public"."calculator_kind" AS ENUM('custo_milheiro', 'transferencia_bonificada', 'compra_pontos', 'dinheiro_vs_milhas', 'retorno_cartao', 'clube_pontos');--> statement-breakpoint
CREATE TYPE "public"."card_brand" AS ENUM('visa', 'mastercard', 'elo', 'amex', 'hipercard', 'diners', 'outra');--> statement-breakpoint
CREATE TYPE "public"."program_kind" AS ENUM('banco', 'aerea', 'hotel', 'varejo', 'outro');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('saldo_inicial', 'acumulo', 'bonus', 'compra', 'transferencia_entrada', 'transferencia_saida', 'resgate', 'expiracao', 'ajuste');--> statement-breakpoint
CREATE TYPE "public"."trip_status" AS ENUM('planejada', 'emitida', 'concluida', 'cancelada');--> statement-breakpoint
CREATE TABLE "balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"source_transaction_id" uuid,
	"original" integer NOT NULL,
	"remaining" integer NOT NULL,
	"expires_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "balances_original_chk" CHECK ("balances"."original" > 0),
	CONSTRAINT "balances_remaining_chk" CHECK ("balances"."remaining" >= 0 and "balances"."remaining" <= "balances"."original")
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"issuer" text NOT NULL,
	"name" text NOT NULL,
	"brand" "card_brand" NOT NULL,
	"annual_fee_brl" numeric(10, 2) DEFAULT '0' NOT NULL,
	"points_per_usd" numeric(6, 2),
	"points_per_brl" numeric(6, 2),
	"program_id" uuid,
	"benefits" text,
	"credit_limit_enc" text,
	"due_day" smallint,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cards_due_day_chk" CHECK ("cards"."due_day" is null or "cards"."due_day" between 1 and 31),
	CONSTRAINT "cards_fee_chk" CHECK ("cards"."annual_fee_brl" >= 0),
	CONSTRAINT "cards_ppu_chk" CHECK ("cards"."points_per_usd" is null or "cards"."points_per_usd" >= 0),
	CONSTRAINT "cards_ppb_chk" CHECK ("cards"."points_per_brl" is null or "cards"."points_per_brl" >= 0)
);
--> statement-breakpoint
CREATE TABLE "loyalty_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"club_name" text,
	"club_monthly_cost_brl" numeric(10, 2),
	"club_monthly_points" integer,
	"milheiro_value_brl" numeric(10, 2),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "la_club_cost_chk" CHECK ("loyalty_accounts"."club_monthly_cost_brl" is null or "loyalty_accounts"."club_monthly_cost_brl" >= 0),
	CONSTRAINT "la_club_points_chk" CHECK ("loyalty_accounts"."club_monthly_points" is null or "loyalty_accounts"."club_monthly_points" >= 0),
	CONSTRAINT "la_milheiro_chk" CHECK ("loyalty_accounts"."milheiro_value_brl" is null or "loyalty_accounts"."milheiro_value_brl" >= 0)
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"usd_rate_brl" numeric(10, 4) DEFAULT '5.5000' NOT NULL,
	"expiry_alert_days" smallint DEFAULT 90 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_expiry_days_chk" CHECK ("profiles"."expiry_alert_days" between 1 and 365)
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"kind" "program_kind" NOT NULL,
	"unit" text DEFAULT 'pontos' NOT NULL,
	"website" text,
	"owner_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"calculator" "calculator_kind" NOT NULL,
	"title" text NOT NULL,
	"input" jsonb NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"type" "transaction_type" NOT NULL,
	"points" integer NOT NULL,
	"occurred_on" date NOT NULL,
	"expires_at" date,
	"card_id" uuid,
	"cost_brl" numeric(12, 2),
	"savings_brl" numeric(12, 2),
	"transfer_group_id" uuid,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tx_points_nonzero_chk" CHECK ("transactions"."points" <> 0),
	CONSTRAINT "tx_sign_chk" CHECK (("transactions"."type" in ('saldo_inicial','acumulo','bonus','compra','transferencia_entrada') and "transactions"."points" > 0)
        or ("transactions"."type" in ('transferencia_saida','resgate','expiracao') and "transactions"."points" < 0)
        or "transactions"."type" = 'ajuste'),
	CONSTRAINT "tx_cost_chk" CHECK ("transactions"."cost_brl" is null or "transactions"."cost_brl" >= 0),
	CONSTRAINT "tx_savings_chk" CHECK ("transactions"."savings_brl" is null or "transactions"."type" = 'resgate')
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"origin" text NOT NULL,
	"destination" text NOT NULL,
	"depart_date" date,
	"return_date" date,
	"passengers" smallint DEFAULT 1 NOT NULL,
	"cabin" "cabin_class" DEFAULT 'economica' NOT NULL,
	"status" "trip_status" DEFAULT 'planejada' NOT NULL,
	"program_id" uuid,
	"miles_needed" integer,
	"cash_price_brl" numeric(12, 2),
	"notes" text,
	"ai_context" jsonb,
	"flexible_dates" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trips_pax_chk" CHECK ("trips"."passengers" between 1 and 9),
	CONSTRAINT "trips_dates_chk" CHECK ("trips"."return_date" is null or "trips"."depart_date" is null or "trips"."return_date" >= "trips"."depart_date"),
	CONSTRAINT "trips_miles_chk" CHECK ("trips"."miles_needed" is null or "trips"."miles_needed" > 0),
	CONSTRAINT "trips_cash_chk" CHECK ("trips"."cash_price_brl" is null or "trips"."cash_price_brl" >= 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "balances" ADD CONSTRAINT "balances_account_id_loyalty_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."loyalty_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balances" ADD CONSTRAINT "balances_source_transaction_id_transactions_id_fk" FOREIGN KEY ("source_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_loyalty_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."loyalty_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "balances_account_idx" ON "balances" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "balances_expires_idx" ON "balances" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "cards_user_idx" ON "cards" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_accounts_user_program_idx" ON "loyalty_accounts" USING btree ("user_id","program_id");--> statement-breakpoint
CREATE UNIQUE INDEX "programs_system_slug_idx" ON "programs" USING btree ("slug") WHERE "programs"."owner_user_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "programs_owner_slug_idx" ON "programs" USING btree ("owner_user_id","slug") WHERE "programs"."owner_user_id" is not null;--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "simulations_user_idx" ON "simulations" USING btree ("user_id","calculator");--> statement-breakpoint
CREATE INDEX "tx_user_date_idx" ON "transactions" USING btree ("user_id","occurred_on");--> statement-breakpoint
CREATE INDEX "tx_account_idx" ON "transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "tx_card_idx" ON "transactions" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "trips_user_idx" ON "trips" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_idx" ON "users" USING btree (lower("email"));