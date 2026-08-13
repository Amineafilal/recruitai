import { redirect } from "next/navigation";
import { getSessionToken } from "./session";

/**
 * Next signale redirect() et notFound() en LEVANT une exception porteuse d'un
 * `digest`. Un `catch` autour d'un apiFetch les avalerait donc silencieusement :
 * une session expirée (apiFetch redirige vers /connexion) s'afficherait en
 * « Suppression impossible » au lieu de renvoyer l'utilisateur à la connexion.
 * Tout catch entourant un apiFetch doit appeler ceci en première ligne.
 */
export function rethrowIfNavigation(err: unknown): void {
  const digest = (err as { digest?: unknown } | null)?.digest;
  if (typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND")) {
    throw err;
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/**
 * Appel serveur → API, authentifié par le JWT interne stocké en cookie
 * httpOnly. Sans session (ou session refusée), on renvoie vers la connexion.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getSessionToken();
  if (!token) redirect("/connexion");

  // Content-Type UNIQUEMENT s'il y a un corps : Fastify rejette en 400 une
  // requête annonçant du JSON avec un corps vide (« Body cannot be empty when
  // content-type is set to 'application/json' »). Sans cette condition, tout
  // POST/DELETE sans payload — déclencher une automatisation, charger la
  // démo — échoue côté serveur.
  const headers: Record<string, string> = {
    ...((init.headers as Record<string, string>) ?? {}),
    Authorization: `Bearer ${token}`,
  };
  if (init.body !== undefined && init.body !== null) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (response.status === 401) redirect("/connexion");
  if (!response.ok) {
    throw new ApiError(response.status, await response.text(), path);
  }
  return response.json() as Promise<T>;
}

/**
 * Échec d'appel API portant le message destiné à l'utilisateur.
 *
 * Avant, l'erreur était une chaîne du type « API /jobs failed: 403 {json} » :
 * la phrase que l'API avait pris soin de rédiger — quelle limite, quelle
 * formule, quoi faire — s'y trouvait noyée, et l'interface affichait soit le
 * brut, soit un message générique. `messageUtilisateur` la restitue.
 */
export class ApiError extends Error {
  readonly statut: number;
  readonly messageUtilisateur: string;

  constructor(statut: number, corps: string, chemin: string) {
    super(`API ${chemin} failed: ${statut} ${corps}`);
    this.name = "ApiError";
    this.statut = statut;
    this.messageUtilisateur = extraireMessage(corps);
  }
}

/** Récupère `message` du corps NestJS, sans se casser sur une réponse non-JSON. */
function extraireMessage(corps: string): string {
  try {
    const parsed = JSON.parse(corps) as { message?: unknown };
    if (typeof parsed.message === "string" && parsed.message.trim()) return parsed.message;
    // NestJS renvoie un tableau quand plusieurs validations échouent.
    if (Array.isArray(parsed.message) && parsed.message.length > 0) return String(parsed.message[0]);
  } catch {
    // Corps non-JSON : on retombe sur le message générique ci-dessous.
  }
  return "L'opération a échoué. Réessayez dans un moment.";
}
