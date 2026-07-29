import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

/**
 * Chargement de la configuration.
 *
 * En développement, tout vient du `.env` unique à la racine du monorepo. En
 * production (Railway, Vercel…), il n'y a pas de fichier : les variables sont
 * injectées par la plateforme. On ne charge donc le fichier que s'il existe,
 * et il ne surcharge jamais une variable déjà définie par l'hébergeur.
 *
 * fileURLToPath : sous Windows, URL.pathname renvoie "/C:/..." et casse fs.
 */
const cheminEnv = fileURLToPath(new URL("../../../.env", import.meta.url));
if (existsSync(cheminEnv)) {
  config({ path: cheminEnv });
}

/**
 * Variables sans lesquelles l'application ne peut pas fonctionner
 * correctement. On échoue au démarrage plutôt qu'à la première requête : une
 * API qui démarre puis renvoie des 500 incompréhensibles est bien plus
 * difficile à diagnostiquer qu'un refus de démarrer explicite.
 */
const REQUISES = ["DATABASE_URL", "DIRECT_URL", "AUTH_JWT_SECRET"] as const;

/**
 * Variables dont l'absence dégrade le service sans l'empêcher de tourner.
 * On les signale au démarrage pour que l'exploitant sache ce qui est inactif.
 */
const RECOMMANDEES: { nom: string; consequence: string }[] = [
  { nom: "RESEND_API_KEY", consequence: "aucun email ne partira (relances, invitations, mot de passe oublié)" },
  { nom: "PUBLIC_APP_URL", consequence: "les liens dans les emails pointeront vers localhost" },
  { nom: "APIFY_TOKEN", consequence: "le sourcing automatique et l'enrichissement seront inactifs" },
  { nom: "MISTRAL_API_KEY", consequence: "les candidats ne seront pas notés" },
];

export function verifierEnvironnement(): void {
  const manquantes = REQUISES.filter((v) => !process.env[v]?.trim());
  if (manquantes.length > 0) {
    throw new Error(
      `Variables d'environnement manquantes : ${manquantes.join(", ")}. ` +
        `L'API ne peut pas démarrer sans elles.`,
    );
  }

  // Un secret par défaut ou trop court rendrait les sessions falsifiables.
  const secret = process.env.AUTH_JWT_SECRET ?? "";
  if (secret.length < 32) {
    throw new Error(
      "AUTH_JWT_SECRET doit faire au moins 32 caractères — un secret court rend les sessions falsifiables.",
    );
  }

  for (const { nom, consequence } of RECOMMANDEES) {
    if (!process.env[nom]?.trim()) {
      console.warn(`[env] ${nom} absent : ${consequence}.`);
    }
  }
}

/**
 * Origines autorisées à appeler l'API depuis un navigateur.
 *
 * En production on n'autorise que le site déclaré : `origin: true` renvoyait
 * l'en-tête d'autorisation à n'importe quel domaine, ce qui laissait un site
 * tiers appeler l'API depuis le navigateur d'un utilisateur connecté.
 *
 * Les appels serveur-à-serveur (Next.js → API) ne sont pas concernés : ils
 * n'envoient pas d'en-tête Origin et ne sont pas soumis au CORS.
 */
export function originesAutorisees(): string[] | boolean {
  const brut = process.env.CORS_ORIGINS?.trim();
  if (brut) {
    return brut
      .split(",")
      .map((o) => o.trim().replace(/\/$/, ""))
      .filter(Boolean);
  }
  // Sans liste explicite : permissif en développement, fermé en production.
  if (process.env.NODE_ENV === "production") {
    console.warn("[env] CORS_ORIGINS absent en production : les appels navigateur seront refusés.");
    return false;
  }
  return true;
}
