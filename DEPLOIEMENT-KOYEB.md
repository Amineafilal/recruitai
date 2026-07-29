# Mise en ligne gratuite — Koyeb + Vercel

Objectif : le produit accessible en ligne pour **0 €**, le temps de décrocher
un premier cabinet pilote.

| Composant | Hébergeur | Coût |
|---|---|---|
| Site (landing + dashboard) | Vercel | gratuit |
| API | Koyeb, région Francfort | gratuit |
| Base de données | Supabase | gratuit (déjà en ligne) |
| Emails | Resend | gratuit |

**Le compromis :** l'instance gratuite Koyeb s'endort après 1 heure sans
trafic. Le premier visiteur attend alors ~20 secondes — mesuré, pas estimé.
Invisible en démo si tu ouvres la page une minute avant.

---

## Étape 1 — L'API sur Koyeb

1. [app.koyeb.com](https://app.koyeb.com) → **Sign up with GitHub**
2. **Create Web Service** → **GitHub** → dépôt `recruitai`
3. Réglages :

   | Champ | Valeur |
   |---|---|
   | Builder | **Dockerfile** |
   | Dockerfile location | `Dockerfile` (racine) |
   | Region | **Frankfurt** |
   | Instance type | **Free** |
   | Port | `8000` |
   | Health check path | `/health` |

   La région compte : Francfort garde les données candidats en Europe,
   cohérent avec l'argumentaire RGPD et avec Supabase, déjà en Irlande.

4. **Environment variables** : coller le contenu de `railway-variables.txt`
   (le fichier fonctionne à l'identique ici), **en changeant une ligne** :

   ```
   SCHEDULER_ENABLED=false
   ```

   Indispensable sur une instance qui s'endort : une tâche planifiée
   démarrée à moitié consommerait des crédits Apify sans terminer son travail.

5. **Deploy**. Le premier build prend 3 à 5 minutes.
6. Vérifier : `https://<ton-service>.koyeb.app/health` → `{"status":"ok"}`

---

## Étape 2 — Le site sur Vercel

1. [vercel.com](https://vercel.com) → **Add New Project** → dépôt `recruitai`
2. ⚠️ **Root Directory** → **Edit** → `apps/web`

   L'erreur la plus fréquente. Sans ça, Vercel cherche un Next.js à la racine
   du monorepo et le build échoue.

3. **Environment Variables**, une seule :

   ```
   NEXT_PUBLIC_API_URL = https://<ton-service>.koyeb.app
   ```

   Injectée à la **compilation** : la modifier plus tard impose un nouveau
   déploiement, un redémarrage ne suffit pas.

4. **Deploy**, puis noter l'URL obtenue.

---

## Étape 3 — Reboucler

Retourner sur Koyeb et renseigner les deux variables laissées en attente :

```
PUBLIC_APP_URL=https://<ton-projet>.vercel.app
CORS_ORIGINS=https://<ton-projet>.vercel.app
```

Sans cette étape : les liens dans les emails pointent vers `localhost`, et le
formulaire de contact est bloqué par le navigateur.

---

## Étape 4 — Vérifier

| Test | Attendu |
|---|---|
| `https://<vercel>/` | La landing s'affiche |
| `https://<koyeb>/health` | `{"status":"ok"}` |
| Créer un compte sur `/inscription` | Redirection vers le tableau de bord |
| Créer un poste | Apparaît dans la liste |
| Formulaire de contact | Envoyé, sans erreur dans la console |

Dans les logs Koyeb au démarrage, tu dois voir :

```
RecruitAI API listening on :8000 (production)
```

Les lignes `[env] … absent` signalent les fonctionnalités inactives faute de
clé. Elles n'empêchent pas le démarrage — c'est voulu.

---

## Mesures réelles

Vérifié localement dans un conteneur bridé aux ressources de l'offre gratuite
Koyeb (0,1 vCPU, 512 Mo) :

| | Mesure |
|---|---|
| Démarrage à froid | **21 s** |
| Mémoire consommée | **145 Mo / 512 Mo** |
| Taille de l'image | 554 Mo |
| Connexion Supabase | OK depuis le conteneur |
| CORS | Origine autorisée acceptée, tierce refusée |

La marge mémoire est confortable : aucun risque de plantage par saturation.

---

## Ce qui ne marchera pas encore

**Les emails.** Resend ne délivre qu'à l'adresse propriétaire du compte tant
qu'aucun domaine n'est vérifié. Sont donc inopérants : relances candidats,
invitations d'équipe, réinitialisation de mot de passe. Débloqué par l'achat
d'un domaine (~12 €/an) et sa vérification sur
[resend.com/domains](https://resend.com/domains).

**Les tâches automatiques**, volontairement désactivées. Le sourcing se
déclenche toujours à la création d'un poste, ce qui suffit pour une démo.

**La facturation.** Les tarifs sont affichés mais Stripe n'est pas branché.

**La route `/demo`** expose des données fictives et reste publique.

**Les témoignages de la landing** sont fictifs — à remplacer par de vrais avis
ou à retirer avant de démarcher.

---

## Le jour où un cabinet signe

1. Passer sur un hébergeur sans mise en veille (Railway ~5 $/mois,
   `railway.json` est déjà prêt à la racine)
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
