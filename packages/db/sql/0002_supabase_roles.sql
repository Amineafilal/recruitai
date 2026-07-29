-- Rôles applicatifs Supabase — à exécuter UNE FOIS, avec le rôle postgres
-- (SQL Editor du dashboard Supabase, ou psql via DIRECT_URL).
--
-- Le rôle postgres de Supabase n'est pas superuser, mais Supabase autorise
-- explicitement la création de rôles BYPASSRLS depuis un rôle non-superuser.
-- Si le CREATE ROLE ... BYPASSRLS échoue en "permission denied", c'est que
-- le projet tourne sur une version antérieure à ce changement : ouvrir un
-- ticket support plutôt que de rabattre l'API sur le rôle postgres.
--
-- Objectif : que l'isolation RLS soit réellement effective en prod. Le rôle
-- utilisé par l'API et le worker ne doit PAS pouvoir contourner les policies,
-- sinon un oubli de clause WHERE expose les données d'une autre agence.
--
-- Remplacer les mots de passe avant exécution.

-- 1. Rôle applicatif : aucune capacité de contournement de RLS.
create role recruitai_app with login password 'CHANGE_ME_app';
grant usage on schema public to recruitai_app;
grant select, insert, update, delete on all tables in schema public to recruitai_app;
grant usage, select on all sequences in schema public to recruitai_app;
-- S'applique aussi aux tables créées par les migrations futures.
alter default privileges in schema public
  grant select, insert, update, delete on tables to recruitai_app;
alter default privileges in schema public
  grant usage, select on sequences to recruitai_app;

-- 2. Rôle d'administration : contourne RLS, réservé aux migrations, à la
--    résolution Clerk→tenant et au scheduler cross-tenant du worker.
create role recruitai_admin with login password 'CHANGE_ME_admin' bypassrls;
grant usage on schema public to recruitai_admin;
grant all on all tables in schema public to recruitai_admin;
grant all on all sequences in schema public to recruitai_admin;
alter default privileges in schema public grant all on tables to recruitai_admin;
alter default privileges in schema public grant all on sequences to recruitai_admin;

-- 3. Vérification : doit renvoyer rolbypassrls = false pour recruitai_app.
--    Si true, l'isolation multi-tenant n'est pas garantie.
select rolname, rolbypassrls
from pg_roles
where rolname in ('recruitai_app', 'recruitai_admin');
