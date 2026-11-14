CREATE TYPE "public"."agent_action_kind" AS ENUM('lancamento', 'transferencia', 'viagem');--> statement-breakpoint
CREATE TYPE "public"."agent_action_status" AS ENUM('pendente', 'confirmada', 'recusada', 'falhou');--> statement-breakpoint
CREATE TYPE "public"."agent_role" AS ENUM('user', 'assistant', 'system');--> statement-breakpoint
CREATE TABLE "agent_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"tool_use_id" text NOT NULL,
	"kind" "agent_action_kind" NOT NULL,
	"summary" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "agent_action_status" DEFAULT 'pendente' NOT NULL,
	"result_message" text,
	"reported_to_agent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "agent_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"role" "agent_role" NOT NULL,
	"content" jsonb NOT NULL,
	"usage" jsonb,
	"stop_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_conversation_id_agent_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."agent_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_conversations" ADD CONSTRAINT "agent_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_conversation_id_agent_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."agent_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_actions_conv_idx" ON "agent_actions" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "agent_actions_user_idx" ON "agent_actions" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "agent_conv_user_idx" ON "agent_conversations" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_msg_conv_seq_idx" ON "agent_messages" USING btree ("conversation_id","seq");