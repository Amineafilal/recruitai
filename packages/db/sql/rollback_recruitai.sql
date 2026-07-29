-- Retrait des objets RecruitAI d'une base qui en héberge d'autres.
--
-- Contexte : le projet sxfrbweqcljcfratogsv hébergeait déjà une application
-- Prisma (companies, contacts, compliance, enrichment_log,
-- prospection_activity, scores, _prisma_migrations). RecruitAI part sur son
-- propre projet Supabase ; ce script rend cette base à son état d'origine.
--
-- Ne nomme QUE des objets créés par RecruitAI. Aucune table Prisma n'est
-- listée ici, et il n'y a volontairement aucun DROP SCHEMA public CASCADE.
-- Vérifié avant exécution : nos 13 tables contenaient 0 ligne.

begin;

drop table if exists outreach_messages cascade;
drop table if exists tenant_scrape_usage cascade;
drop table if exists subscriptions cascade;
drop table if exists audit_log cascade;
drop table if exists consents cascade;
drop table if exists campaigns cascade;
drop table if exists signals cascade;
drop table if exists cvtheque_profiles cascade;
drop table if exists sourcing_candidates cascade;
drop table if exists raw_scrape_results cascade;
drop table if exists jobs cascade;
drop table if exists users cascade;
drop table if exists tenants cascade;

drop type if exists outreach_status;
drop type if exists consent_type;
drop type if exists signal_type;
drop type if exists validation_status;
drop type if exists scrape_status;
drop type if exists scrape_source;
drop type if exists job_status;
drop type if exists user_role;
drop type if exists plan_id;

-- Journal des migrations Drizzle (schéma dédié, distinct de _prisma_migrations).
drop schema if exists drizzle cascade;

commit;
