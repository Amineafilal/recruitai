# Mise en ligne de RecruitAI

Architecture cible :

| Composant | Hébergeur | Rôle |
|---|---|---|
| Site (Next.js) | Vercel | Landing, dashboard, authentification |
| API (NestJS) | Railway | Données, scoring, tâches automatiques |
| Base de données | Supabase | Déjà en ligne, rien à faire |

L'API et le site sont **deux services séparés**. Le site appelle l'API côté
serveur avec le jeton de session ; le navigateur n'appelle directement l'API
que pour le formulaire de contact.

---

## Étape 0 — Mettre le code sur GitHub

Vercel et Railway déploient depuis un dépôt Git.

```bash
git init && git add -A && git commit -m "RecruitAI"
```

Vérifier **avant de pousser** que le fichier `.env` n'est pas inclus :

```bash
git ls-files | grep -c "^\.env$"
```

Le résultat doit être `0`. S'il vaut `1`, arrêter : le fichier contient tes
mots de passe de base de données et tes clés d'API.

Créer ensuite un dépôt **privé** sur github.com et suivre les instructions de
`git remote add` / `git push` affichées par GitHub.

---

## Étape 1 — L'API sur Railway

1. Sur [railway.app](https://railway.app), créer un projet à partir du dépôt GitHub.
2. Railway lit `railway.json` : commande de démarrage et surveillance `/health`
   sont déjà configurées.
3. Onglet **Variables** : coller le contenu des variables marquées `[API]` dans
   `.env.example`, avec les vraies valeurs de ton `.env` local.

   Deux valeurs changent par rapport au local :

   ```
   NODE_ENV=production
   PUBLIC_APP_URL=<URL Vercel, connue à l'étape 2>
   CORS_ORIGINS=<même URL Vercel>
   ```

   L'API refusera de démarrer si `DATABASE_URL`, `DIRECT_URL` ou
   `AUTH_JWT_SECRET` manquent — c'est volontaire : mieux vaut un échec clair
   au démarrage qu'une API qui répond des erreurs 500 incompréhensibles.

4. Onglet **Settings → Networking → Generate Domain**. Noter l'URL obtenue
   (`recruitai-api-production.up.railway.app`).
5. Vérifier : `https://<url-railway>/health` doit renvoyer `{"status":"ok"}`.

> **Ne jamais augmenter le nombre de replicas.** Les tâches automatiques
> tournent dans le processus de l'API : deux instances enverraient les relances
> en double et consommeraient le quota de scraping deux fois.

---

## Étape 2 — Le site sur Vercel

1. Sur [vercel.com](https://vercel.com), importer le même dépôt GitHub.
2. **Root Directory** : `apps/web` — indispensable, sinon Vercel cherche un
   Next.js à la racine du monorepo et échoue.
3. Framework : Next.js (détecté automatiquement).
4. **Environment Variables** — une seule est nécessaire :

   ```
   NEXT_PUBLIC_API_URL=https://<url-railway-de-l-étape-1>
   ```

   ⚠️ Cette variable est injectée **à la compilation**. La modifier plus tard
   impose de relancer un déploiement ; un simple redémarrage ne suffit pas.

5. Déployer, puis noter l'URL (`recruitai.vercel.app`).

---

## Étape 3 — Reboucler

Retourner sur Railway et corriger les deux variables laissées en attente :

```
PUBLIC_APP_URL=https://recruitai.vercel.app
CORS_ORIGINS=https://recruitai.vercel.app
```

Railway redémarre l'API automatiquement.

Sans cette étape : les liens d'invitation et de réinitialisation de mot de
passe pointeraient vers `localhost`, et le formulaire de contact serait bloqué
par le navigateur.

---

## Étape 4 — Vérifier

| Test | Attendu |
|---|---|
| `https://<vercel>/` | La landing s'affiche |
| `https://<railway>/health` | `{"status":"ok"}` |
| Créer un compte sur `/inscription` | Redirection vers le tableau de bord |
| Formulaire de contact | Message envoyé, sans erreur console |
| Logs Railway au démarrage | `RecruitAI API listening on :… (production)` |

Les avertissements `[env] … absent` dans les logs Railway indiquent les
fonctionnalités inactives faute de clé. Ils ne bloquent pas le démarrage.

---

## Ce qui ne marchera pas encore

**Les emails.** Tant qu'aucun domaine n'est vérifié sur
[resend.com/domains](https://resend.com/domains), Resend ne délivre qu'à
l'adresse propriétaire du compte. Sont donc inopérants en production :

- les relances candidats — soit la moitié de la proposition de valeur ;
- les invitations d'équipe ;
- la réinitialisation de mot de passe.

Une fois un domaine acheté et vérifié, mettre à jour sur Railway :

```
OUTREACH_FROM_EMAIL=RecruitAI <contact@tondomaine.ma>
```

**La facturation.** Les tarifs sont affichés sur la landing mais Stripe n'est
pas branché : personne ne peut payer, et les quotas des plans ne sont pas
appliqués commercialement.

**La route `/demo`.** Elle expose des données fictives et reste accessible
publiquement. À retirer avant de démarcher de vrais clients, ou à assumer
comme démonstration produit.

**Les témoignages de la landing** sont des exemples fictifs. Les remplacer par
de vrais avis, ou retirer la section — afficher de faux témoignages clients
est un risque juridique et réputationnel.

---

## Coûts mensuels

| Poste | Coût |
|---|---|
| Vercel (Hobby) | gratuit |
| Railway | ~5 $ (offre Hobby, à l'usage) |
| Supabase | gratuit jusqu'à 500 Mo |
| Resend | gratuit jusqu'à 3 000 emails/mois |
| Apify | dans le crédit mensuel offert, tant que `SCRAPE_CREDITS_CAP` reste bas |
| Mistral | quelques centimes aux volumes actuels |

**Environ 5 $/mois** au départ. Le poste à surveiller est Apify : chaque poste
sourcé et chaque profil CVthèque enrichi consomme des crédits réels. Le coût
par client sur un mois complet n'a jamais été mesuré — à faire avant de fixer
définitivement les tarifs.

---

## Après chaque modification du schéma de base

Les migrations ne sont **pas** jouées automatiquement au déploiement, pour
éviter qu'un redémarrage intempestif ne modifie la base de production. Les
lancer explicitement depuis ton poste, `DIRECT_URL` pointant vers la base
concernée :

```bash
npm run db:migrate
```

Puis, si de nouvelles tables ont été créées :

```bash
npm run rls --workspace=@recruitai/db
```

Oublier la seconde commande laisserait les nouvelles tables **sans isolation
entre agences**.
