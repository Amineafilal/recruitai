CREATE TYPE "public"."sourcing_statut" AS ENUM('en_cours', 'termine', 'echec');--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "sourcing_statut" "sourcing_statut";--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "sourcing_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "sourcing_message" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "sourcing_candidats" integer;