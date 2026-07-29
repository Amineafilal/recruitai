CREATE TYPE "public"."pipeline_stage" AS ENUM('source', 'a_valider', 'retenu', 'entretien_planifie', 'entretien_realise', 'offre_envoyee', 'embauche', 'rejete');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "candidate_stage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"etape_avant" "pipeline_stage",
	"etape_apres" "pipeline_stage" NOT NULL,
	"auteur_user_id" uuid,
	"auteur_email" text NOT NULL,
	"commentaire" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sourcing_candidates" ADD COLUMN "etape" "pipeline_stage" DEFAULT 'source' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "candidate_stage_events" ADD CONSTRAINT "candidate_stage_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "candidate_stage_events" ADD CONSTRAINT "candidate_stage_events_candidate_id_sourcing_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."sourcing_candidates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "candidate_stage_events" ADD CONSTRAINT "candidate_stage_events_auteur_user_id_users_id_fk" FOREIGN KEY ("auteur_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- Reprise des données : la colonne `etape` est créée avec 'source' par défaut,
-- ce qui écraserait les décisions déjà prises par les recruteurs. On rejoue
-- donc l'ancien statut sur la nouvelle échelle.
UPDATE "sourcing_candidates" SET "etape" = 'retenu' WHERE "statut_validation" = 'valide';--> statement-breakpoint
UPDATE "sourcing_candidates" SET "etape" = 'rejete' WHERE "statut_validation" = 'rejete';--> statement-breakpoint
-- Un événement d'entrée pour chaque candidat existant : sans ça leur timeline
-- démarrerait vide, comme s'ils n'avaient jamais été traités.
INSERT INTO "candidate_stage_events" ("tenant_id", "candidate_id", "etape_avant", "etape_apres", "auteur_email", "commentaire", "created_at")
SELECT "tenant_id", "id", NULL, "etape", 'système', 'Reprise lors de la mise en place du pipeline', "created_at"
FROM "sourcing_candidates";
