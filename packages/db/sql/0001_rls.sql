-- Row-Level Security: isolation stricte entre agences (tenants).
-- Toute requête applicative doit passer par withTenant(), qui fixe
-- app.tenant_id pour la durée de la transaction via set_config().
-- Sans cette variable de session, aucune ligne n'est visible.
--
-- FORCE ROW LEVEL SECURITY est utilisé volontairement : par défaut Postgres
-- exempte le propriétaire de la table de ses propres policies RLS, ce qui
-- rendrait l'isolation illusoire dès qu'on sert des requêtes avec ce rôle.
-- Avec FORCE, seul un rôle ayant explicitement BYPASSRLS peut lire/écrire
-- hors RLS.
--
-- Deux rôles, créés par 0002_supabase_roles.sql :
--   recruitai_app   — sans BYPASSRLS, utilisé par l'API et le worker via
--                     withTenant(). C'est lui qui rend l'isolation réelle.
--   recruitai_admin — avec BYPASSRLS, réservé aux migrations, à la résolution
--                     Clerk→tenant et au scheduler cross-tenant.
--
-- À exécuter avec le rôle postgres (propriétaire des tables), via DIRECT_URL.

alter table tenants enable row level security;
alter table users enable row level security;
alter table jobs enable row level security;
alter table raw_scrape_results enable row level security;
alter table sourcing_candidates enable row level security;
alter table cvtheque_profiles enable row level security;
alter table signals enable row level security;
alter table campaigns enable row level security;
alter table consents enable row level security;
alter table audit_log enable row level security;
alter table subscriptions enable row level security;
alter table tenant_scrape_usage enable row level security;
alter table outreach_messages enable row level security;

alter table tenants force row level security;
alter table users force row level security;
alter table jobs force row level security;
alter table raw_scrape_results force row level security;
alter table sourcing_candidates force row level security;
alter table cvtheque_profiles force row level security;
alter table signals force row level security;
alter table campaigns force row level security;
alter table consents force row level security;
alter table audit_log force row level security;
alter table subscriptions force row level security;
alter table tenant_scrape_usage force row level security;
alter table outreach_messages force row level security;

-- Pourquoi nullif(..., '') et pas directement ::uuid :
-- current_setting('app.tenant_id', true) renvoie NULL si la variable n'a
-- jamais existé sur la session, mais une CHAÎNE VIDE si elle a déjà été
-- posée puis relâchée en fin de transaction — ce qui est le cas permanent
-- avec le pooler Supabase, qui recycle les connexions physiques.
-- Sans nullif, ''::uuid lève "invalid input syntax for type uuid" au lieu de
-- ne renvoyer aucune ligne : toute requête hors withTenant() planterait sur
-- une connexion recyclée. Avec nullif, la comparaison vaut NULL donc faux,
-- et la requête retourne zéro ligne comme attendu.

-- tenants: un tenant ne voit que sa propre ligne (via son propre id)
drop policy if exists tenant_isolation on tenants;
create policy tenant_isolation on tenants
  using (id = nullif(current_setting('app.tenant_id', true), '')::uuid);

drop policy if exists tenant_isolation on users;
create policy tenant_isolation on users
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

drop policy if exists tenant_isolation on jobs;
create policy tenant_isolation on jobs
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

drop policy if exists tenant_isolation on raw_scrape_results;
create policy tenant_isolation on raw_scrape_results
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

drop policy if exists tenant_isolation on sourcing_candidates;
create policy tenant_isolation on sourcing_candidates
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

drop policy if exists tenant_isolation on cvtheque_profiles;
create policy tenant_isolation on cvtheque_profiles
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

drop policy if exists tenant_isolation on signals;
create policy tenant_isolation on signals
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

drop policy if exists tenant_isolation on campaigns;
create policy tenant_isolation on campaigns
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

drop policy if exists tenant_isolation on consents;
create policy tenant_isolation on consents
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

drop policy if exists tenant_isolation on audit_log;
create policy tenant_isolation on audit_log
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

drop policy if exists tenant_isolation on subscriptions;
create policy tenant_isolation on subscriptions
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

drop policy if exists tenant_isolation on tenant_scrape_usage;
create policy tenant_isolation on tenant_scrape_usage
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

drop policy if exists tenant_isolation on outreach_messages;
create policy tenant_isolation on outreach_messages
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- ---------------------------------------------------------------------------
-- Tables ajoutées : réinitialisation de mot de passe, invitations, notes.
-- ---------------------------------------------------------------------------

alter table password_reset_tokens enable row level security;
alter table invitations enable row level security;
alter table candidate_notes enable row level security;

alter table password_reset_tokens force row level security;
alter table invitations force row level security;
alter table candidate_notes force row level security;

-- password_reset_tokens et invitations sont lus AVANT toute connexion (il n'y
-- a alors pas de tenant en session) : ces lectures passent volontairement par
-- le rôle admin. La policy ci-dessous n'ouvre donc rien au rôle applicatif
-- hors contexte tenant — c'est exactement l'effet voulu : un jeton de reset
-- n'est jamais lisible depuis une requête applicative ordinaire.
drop policy if exists tenant_isolation on password_reset_tokens;
create policy tenant_isolation on password_reset_tokens
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

drop policy if exists tenant_isolation on invitations;
create policy tenant_isolation on invitations
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

drop policy if exists tenant_isolation on candidate_notes;
create policy tenant_isolation on candidate_notes
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- Historique des changements d'étape du pipeline. Même isolation que le reste :
-- une agence ne doit jamais voir qui a déplacé le candidat d'une autre.
alter table candidate_stage_events enable row level security;
alter table candidate_stage_events force row level security;

drop policy if exists tenant_isolation on candidate_stage_events;
create policy tenant_isolation on candidate_stage_events
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- Activités candidat (score, appels, emails hors campagne).
alter table candidate_activities enable row level security;
alter table candidate_activities force row level security;

drop policy if exists tenant_isolation on candidate_activities;
create policy tenant_isolation on candidate_activities
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
