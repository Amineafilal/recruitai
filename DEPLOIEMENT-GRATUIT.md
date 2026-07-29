# Mise en ligne gratuite — Render + Vercel

Objectif : le produit accessible en ligne pour **0 €**, le temps de décrocher
un premier cabinet pilote.

| Composant | Hébergeur | Coût |
|---|---|---|
| Site (landing + dashboard) | Vercel | gratuit |
| API | Render, région Francfort | gratuit |
| Base de données | Supabase | gratuit (déjà en ligne) |
| Emails | Resend | gratuit |

**Le compromis :** l'offre gratuite Render met le service en veille après
15 minutes sans trafic. Le premier visiteur attend alors ~1 minute. Pour une
démo, ouvre la page une minute avant — le service reste ensuite éveillé tant
qu'on l'utilise.

> Koyeb a été écarté : depuis son rachat par Mistral, les nouveaux comptes ne
> peuvent souscrire qu'aux plans Pro et au-dessus. Son offre gratuite n'existe
> plus. Le `Dockerfile` reste identique, il fonctionne partout.

---

## Étape 1 — L'API sur Render

1. [dashboard.render.com](https://dashboard.render.com) → **Sign up with GitHub**
2. **New** → **Blueprint**
3. Sélectionner le dépôt `recruitai`

   Render lit `render.yaml` à la racine : service, région Francfort,
   surveillance `/health` et réglages non sensibles sont déjà décrits.

4. Render demande alors les valeurs marquées `sync: false` — ce sont tes
   secrets, ils ne sont jamais écrits dans le dépôt. Reprends-les depuis
   `railway-variables.txt` (le même fichier fonctionne ici) :

   | Variable | Où la trouver |
   |---|---|
   | `DATABASE_URL` | ton `.env` |
   | `DIRECT_URL` | ton `.env` |
   | `ADMIN_DATABASE_URL` | ton `.env` |
   | `AUTH_JWT_SECRET` | ton `.env` |
   | `RESEND_API_KEY` | ton `.env` |
   | `OUTREACH_FROM_EMAIL` | ton `.env` |
   | `CONTACT_TO_EMAIL` | ton `.env` |
   | `APIFY_TOKEN` | ton `.env` |
   | `MISTRAL_API_KEY` | ton `.env` |
   | `PUBLIC_APP_URL` | **laisser vide** — connue à l'étape 2 |
   | `CORS_ORIGINS` | **laisser vide** — connue à l'étape 2 |

5. **Apply**. Le premier build prend 5 à 10 minutes (construction de l'image).
6. Vérifier : `https://recruitai-api.onrender.com/health` → `{"status":"ok"}`

---

## Étape 2 — Le site sur Vercel

1. [vercel.com](https://vercel.com) → **Add New Project** → dépôt `recruitai`
2. ⚠️ **Root Directory** → **Edit** → `apps/web`

   L'erreur la plus fréquente. Sans ça, Vercel cherche un Next.js à la racine
   du monorepo et le build échoue.

3. **Environment Variables**, une seule :

   ```
   NEXT_PUBLIC_API_URL = https://recruitai-api.onrender.com
   ```

   Injectée à la **compilation** : la modifier plus tard impose un nouveau
   déploiement, un redémarrage ne suffit pas.

4. **Deploy**, puis noter l'URL obtenue.

---

## Étape 3 — Reboucler

Retourner sur Render → service `recruitai-api` → **Environment**, et
renseigner les deux variables laissées vides :

```
PUBLIC_APP_URL=https://<ton-projet>.vercel.app
CORS_ORIGINS=https://<ton-projet>.vercel.app
```

Render redémarre automatiquement.

Sans cette étape : les liens dans les emails pointent vers `localhost`, et le
formulaire de contact est bloqué par le navigateur.

---

## Étape 4 — Vérifier

| Test | Attendu |
|---|---|
| `https://<vercel>/` | La landing s'affiche |
| `https://<render>/health` | `{"status":"ok"}` |
| Créer un compte sur `/inscription` | Redirection vers le tableau de bord |
| Créer un poste | Apparaît dans la liste |
| Formulaire de contact | Envoyé, sans erreur dans la console |

Dans les logs Render au démarrage :

```
RecruitAI API listening on :10000 (production)
```

Le numéro de port vient de Render, c'est normal. Les lignes `[env] … absent`
signalent les fonctionnalités inactives faute de clé ; elles n'empêchent pas
le démarrage.

---

## Mesures réelles

Vérifié localement dans un conteneur bridé à 0,1 vCPU et 512 Mo — soit moins
que ce que donne l'offre gratuite Render :

| | Mesure |
|---|---|
| Démarrage à froid | 21 s |
| Mémoire consommée | 145 Mo / 512 Mo |
| Taille de l'image | 554 Mo |
| Connexion Supabase | OK depuis le conteneur |
| CORS | Origine autorisée acceptée, tierce refusée |

---

## Ce qui ne marchera pas encore

**Les emails.** Resend ne délivre qu'à l'adresse propriétaire du compte tant
qu'aucun domaine n'est vérifié. Sont donc inopérants : relances candidats,
invitations d'équipe, réinitialisation de mot de passe. Débloqué par l'achat
d'un domaine (~12 €/an) et sa vérification sur
[resend.com/domains](https://resend.com/domains).

**Les tâches automatiques**, volontairement désactivées (`SCHEDULER_ENABLED=false`).
Le sourcing se déclenche toujours à la création d'un poste, ce qui suffit
pour une démo.

**La facturation.** Les tarifs sont affichés mais Stripe n'est pas branché.

**La route `/demo`** expose des données fictives et reste publique.

**Les témoignages de la landing** sont fictifs — à remplacer par de vrais avis
ou à retirer avant de démarcher.

---

## Le jour où un cabinet signe

1. Passer le service Render en offre payante (7 $/mois, plus de mise en
   veille), ou basculer sur Railway (`railway.json` est prêt à la racine)
2. Remettre `SCHEDULER_ENABLED=true`
3. Vérifier un domaine chez Resend et changer `OUTREACH_FROM_EMAIL`

Le code ne change pas : seules les variables bougent.

---

## Après chaque modification du schéma de base

Les migrations ne sont **pas** jouées au déploiement, pour éviter qu'un
redémarrage ne modifie la base de production. À lancer depuis ton poste :

```bash
npm run db:migrate
```

Puis, si de nouvelles tables ont été créées :

```bash
npm run rls --workspace=@recruitai/db
```

Oublier la seconde commande laisserait les nouvelles tables **sans isolation
entre agences**.
