CREATE TYPE "public"."scoring_status" AS ENUM('ok', 'echec');--> statement-breakpoint
ALTER TABLE "sourcing_candidates" ALTER COLUMN "score" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sourcing_candidates" ADD COLUMN "statut_scoring" "scoring_status" DEFAULT 'ok' NOT NULL;--> statement-breakpoint
ALTER TABLE "sourcing_candidates" ADD COLUMN "scoring_erreur" text;--> statement-breakpoint
ALTER TABLE "sourcing_candidates" ADD COLUMN "scoring_tentatives" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sourcing_candidates" ADD COLUMN "scoring_justification" text;