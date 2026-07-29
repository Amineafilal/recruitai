CREATE TYPE "public"."outreach_status" AS ENUM('envoye', 'echec', 'bloque_opt_out');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "outreach_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"signal_id" uuid,
	"destinataire" text NOT NULL,
	"sujet" text NOT NULL,
	"statut" "outreach_status" DEFAULT 'envoye' NOT NULL,
	"erreur" text,
	"provider_message_id" text,
	"envoye_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "nom" text NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "sujet" text NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "delai_min_relance_jours" integer DEFAULT 90 NOT NULL;--> statement-breakpoint
ALTER TABLE "consents" ADD COLUMN "dedupe_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "consents" ADD COLUMN "source" text DEFAULT 'lien_email' NOT NULL;--> statement-breakpoint
ALTER TABLE "cvtheque_profiles" ADD COLUMN "opt_out_token" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_profile_id_cvtheque_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."cvtheque_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_signal_id_signals_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."signals"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "cvtheque_profiles" ADD CONSTRAINT "cvtheque_profiles_opt_out_token_unique" UNIQUE("opt_out_token");