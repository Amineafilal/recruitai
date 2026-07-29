# RecruitAI

SaaS de sourcing IA pour agences de recrutement mid-market (France/Belgique/Suisse).

## Prérequis

- **Supabase** — projet en région **EU** (Frankfurt ou Paris). Obligatoire :
  les données candidats doivent rester en Europe.
- **Upstash Redis** — région EU également (BullMQ). Supabase ne fournit pas
  de Redis, et il n'y a plus de Docker local.

## Installation

```bash
cp .env.example .env          # renseigner DATABASE_URL, DIRECT_URL, ADMIN_DATABASE_URL, REDIS_URL
npm install

# 1. Rôles Postgres — à exécuter UNE FOIS dans le SQL Editor Supabase
#    (contenu de packages/db/sql/0002_supabase_roles.sql, mots de passe à changer)

# 2. Schéma + sécurité
npm run db:migrate                                   # tables (via DIRECT_URL)
npm run --workspace=@recruitai/db rls                # policies RLS
npm run --workspace=@recruitai/db check-isolation    # PROUVE que l'isolation marche

npm run dev                   # api + web + worker
```

- API : http://localhost:3001 (health : `/health`)
- Web : http://localhost:3000

### Trois connexions, trois usages

| Variable | Port | Rôle | Usage |
|---|---|---|---|
| `DATABASE_URL` | 6543 (pooler) | `recruitai_app` — **sans** BYPASSRLS | Runtime : tout `withTenant()` |
| `DIRECT_URL` | 5432 (direct) | `postgres` | Migrations, DDL, policies |
| `ADMIN_DATABASE_URL` | 5432 | `recruitai_admin` — **avec** BYPASSRLS | Résolution Clerk→tenant, scheduler |

Le pooler tourne en mode transaction, d'où `prepare: false` sur la connexion
applicative (les prepared statements sont liés à la session et cassent dès
qu'une connexion physique est recyclée). `set_config(..., true)` étant
transaction-scoped, il reste compatible avec ce mode.

## Structure

| Chemin | Rôle |
|---|---|
| `apps/api` | NestJS (Fastify) — REST, résolution tenant via Clerk |
| `apps/web` | Next.js 14 App Router + Tailwind — dashboard recruteur |
| `apps/worker` | BullMQ — scraping Apify, scoring, enrichissement CVthèque |
| `packages/db` | Drizzle : schéma, migrations, policies RLS, `withTenant()` |
| `packages/ai` | Scoring candidat (Mistral par défaut, fallback OpenAI) |
| `packages/types` | Schémas Zod partagés + configuration des plans |

## Isolation multi-tenant

Toute lecture/écriture de données d'agence passe par `withTenant(tenantId, fn)`
(`packages/db/src/client.ts`), qui ouvre une transaction et fixe
`app.tenant_id` via `set_config`. Les policies de
`packages/db/sql/0001_rls.sql` (en `FORCE ROW LEVEL SECURITY`) filtrent alors
chaque table sur ce tenant.

Comme le rôle runtime `recruitai_app` n'a pas `BYPASSRLS`, l'isolation est
garantie **par Postgres**, pas par la discipline du code : un oubli de clause
`WHERE tenant_id = …` ne peut pas exposer les données d'une autre agence.

`getAdminDb()` contourne RLS et n'a que trois usages légitimes : migrations,
résolution Clerk org → tenant à l'authentification (`TenantGuard`), et le
scheduler cross-tenant du worker.

`npm run --workspace=@recruitai/db check-isolation` crée deux agences
fictives et vérifie qu'aucune ne peut lire ni modifier les données de
l'autre, y compris sans contexte tenant. À relancer après toute migration.

Les policies comparent `nullif(current_setting('app.tenant_id', true), '')`
et non la valeur brute : avec le pooler Supabase, une connexion recyclée
renvoie une **chaîne vide** (et non `NULL`) une fois la transaction
terminée, et `''::uuid` lève une erreur au lieu de filtrer. Ne pas retirer
le `nullif`.

## Budget de scraping

`tenant_scrape_usage` plafonne les crédits Apify par tenant et par mois selon
le plan (`PLAN_CONFIGS` dans `packages/types/src/plan.ts`). Le plafond est
vérifié *avant* chaque enqueue : quand il est atteint, l'enrichissement
CVthèque s'arrête et le sourcing des postes actifs reste prioritaire.

## Import CVthèque

`POST /cvtheque/import` (multipart, champ fichier unique) — parsing en
streaming, donc un export de 50k lignes ne charge jamais tout en mémoire.

- Séparateur détecté automatiquement (`;`, `,` ou tabulation) : les exports
  ATS français sont majoritairement en point-virgule.
- En-têtes reconnus par alias, accents et casse ignorés (`Prénom`, `E-mail`,
  `Profil LinkedIn`…) — aucun format imposé au client.
- Dédoublonnage par email, à défaut par URL LinkedIn normalisée. Unicité
  garantie en base par `cvtheque_profiles_tenant_dedupe_idx`, donc
  ré-importer le même fichier met à jour au lieu de dupliquer.
- Lignes multiples pour un même contact : fusion champ par champ, une valeur
  renseignée n'est jamais écrasée par du vide.
- Refus si le volume dépasse `maxCvthequeProfiles` du plan.

Réponse : `{ lignesLues, importes, misAJour, ignoresSansIdentifiant, doublonsDansLeFichier }`.

## Tests

```bash
npm run --workspace=@recruitai/db check-isolation   # isolation multi-tenant
npm run --workspace=@recruitai/api test:e2e         # import, opt-out, relances, purge
```

Les deux tournent contre la vraie base Supabase, créent un tenant jetable et
le suppriment en sortie (y compris en cas d'échec). `test:e2e` couvre :
import et dédoublonnage, ré-import idempotent, fusion de lignes partielles,
opt-out par jeton, **survie de l'opt-out à un ré-import**, ciblage des
relances, anti-relance, et sélection de la purge RGPD.

Les requêtes critiques (ciblage des relances, purge) vivent dans
`packages/db/src/queries.ts` et sont partagées entre le worker et les tests,
pour qu'elles ne puissent pas diverger.

## Relances automatiques

Campagnes gérées via `/campagnes` (CRUD + `GET /campagnes/messages` pour
l'historique d'envoi). Le worker `outreach:send` part **à 9h en semaine
uniquement** — pas de mail de recrutement la nuit ni le week-end.

Templates : variables `{{prenom}}`, `{{nom}}`, `{{poste}}`, `{{entreprise}}`,
`{{localisation}}`. Toute autre variable est neutralisée et les valeurs sont
échappées en HTML (les contacts viennent de CSV clients, jamais de confiance).

## RGPD

| Garde-fou | Mise en œuvre |
|---|---|
| Droit d'opposition | Lien de désinscription ajouté **par le système** à chaque email — un recruteur ne peut pas le retirer en éditant son template |
| Opt-out durable | Enregistré sur la `dedupe_key`, pas sur l'id de fiche : ré-importer le CSV ne « réveille » pas un candidat désinscrit |
| Pas de faux opt-out | Route publique en `POST` + confirmation explicite : les clients mail pré-visitent les liens, un `GET` provoquerait des désinscriptions fantômes |
| Anti-harcèlement | `delaiMinRelanceJours` (90 par défaut) appliqué **toutes campagnes confondues** |
| Traçabilité | Chaque envoi, échec et blocage journalisé dans `outreach_messages` + `audit_log` |
| Rétention | Purge hebdomadaire des profils sans contact depuis `RGPD_RETENTION_MOIS` (24 par défaut, recommandation CNIL). Les consentements ne sont jamais purgés — effacer un opt-out autoriserait un nouveau démarchage |

## Provisioning des agences (webhook Clerk)

Une agence = une **Organization** Clerk (à activer dans le dashboard Clerk).
Le webhook `POST /webhooks/clerk` (signature vérifiée via Svix) crée et
maintient les lignes `tenants` et `users` :

| Événement Clerk | Effet |
|---|---|
| `organization.created` / `.updated` | upsert `tenants` |
| `organization.deleted` | suppression `tenants` (cascade users/données) |
| `organizationMembership.created` / `.updated` | upsert `users` (rôle `org:admin` → `admin`) |
| `organizationMembership.deleted` | suppression `users` |

Tout est idempotent (Clerk réessaie et ne garantit pas l'ordre). Config :
dans le dashboard Clerk, créer un endpoint webhook pointant sur
`https://<api>/webhooks/clerk`, s'abonner aux événements `organization*` et
`organizationMembership*`, et copier le *Signing Secret* (`whsec_…`) dans
`CLERK_WEBHOOK_SECRET`.

Test : lancer l'API avec un `CLERK_WEBHOOK_SECRET` connu, puis
`npm run --workspace=@recruitai/api test:webhook` (même secret) — signe de
vrais payloads Svix et vérifie le provisioning en base.

## Runtime NestJS

L'API tourne via **@swc-node/register** (`npm run dev` / `start`), pas tsx :
esbuild n'émet pas les métadonnées de décorateurs dont l'injection de
dépendances NestJS a besoin. SWC les émet (voir `apps/api/.swcrc`).

> Plugins Fastify épinglés en v8 (`@fastify/cors`, `@fastify/multipart`) :
> NestJS 10 embarque Fastify 4, les v9/v10 exigent Fastify 5.

## Sourcing (module 1) — chaîne validée

`scheduler → sourcing-scrape (Apify) → sourcing-normalize (scoring Mistral) → sourcing_candidates`

- Actor LinkedIn : **harvestapi/linkedin-profile-search** (no-cookies), mode
  `Short` (0,10 $/page jusqu'à 25 profils) — suffisant, les profils incluent
  `currentPositions` avec titre + description détaillée.
- `buildActorInput` mappe les critères du poste au schéma réel de l'actor
  (`searchQuery`, `currentJobTitles`, `locations`, `maxItems`). Brancher par
  source : les sources sans actor configuré sont refusées explicitement.
- Le scheduler ne planifie que les sources dont `APIFY_<SOURCE>_ACTOR_ID` est
  défini.
- Scoring **hors transaction** (les appels Mistral ne tiennent plus une
  connexion Postgres du pooler ouverte), prompt calibré pour discriminer
  (dev React/Lyon → 95, graphiste/Paris → 0 sur le même poste).
- Plafond de crédits par tenant appliqué (`tenant_scrape_usage`).

Test (⚠️ dépense des crédits Apify réels) :
```bash
APIFY_MAX_PROFILES_PER_SEARCH=3 npm run --workspace=@recruitai/worker test:sourcing
```

## Dashboard recruteur (apps/web)

Cockpit sombre reprenant l'identité du pitch deck (navy, accent magenta),
fonts Bricolage Grotesque / Instrument Sans / JetBrains Mono. Élément
signature : l'anneau de score (`ScoreRing`) sur la shortlist.

Écrans, câblés à l'API réelle :
- **Postes** — liste + création (modal), stats.
- **Shortlist** (`/postes/[id]`) — candidats scorés, validation/rejet en
  Server Action, présentée comme le « briefing du matin ».
- **CVthèque** — profils chauds + import CSV (le fichier transite par le
  serveur Next avec le token Clerk, jamais exposé au navigateur).
- **Campagnes** — liste des relances.

Aperçu design **sans authentification** : route publique `/demo/*` avec
données fictives (à retirer avant la prod — voir `middleware.ts`).

```bash
npm run dev --workspace=@recruitai/web   # http://localhost:3000
# Démo : http://localhost:3000/demo/postes
```

## Reste à faire (MVP)

- Actors job boards (Indeed/Apec/WTTJ) : mapping `buildActorInput` par source
- Connecteurs ATS (au-delà du CSV)
- Écran de création/édition de campagne (liste OK, formulaire à faire)
- Retirer la route `/demo` avant la mise en production (templates + Resend) et journalisation des consentements
- Stripe Billing : vérification de signature du webhook (`billing.controller.ts` est un stub)
- Choix des actors Apify définitifs + ajustement de `buildActorInput()` par source
- Sentry + alerte sur échec/dataset vide d'un actor
