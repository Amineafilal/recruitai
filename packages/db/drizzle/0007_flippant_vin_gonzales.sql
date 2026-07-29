CREATE TYPE "public"."activity_type" AS ENUM('score', 'appel', 'email', 'autre');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "candidate_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"type" "activity_type" NOT NULL,
	"resume" text NOT NULL,
	"details" text,
	"meta" jsonb,
	"auteur_user_id" uuid,
	"auteur_email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "candidate_activities" ADD CONSTRAINT "candidate_activities_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "candidate_activities" ADD CONSTRAINT "candidate_activities_candidate_id_sourcing_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."sourcing_candidates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "candidate_activities" ADD CONSTRAINT "candidate_activities_auteur_user_id_users_id_fk" FOREIGN KEY ("auteur_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
