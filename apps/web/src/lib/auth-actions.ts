"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "./session";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 jours
};

/** Message montré quand l'API ne répond pas du tout. */
const API_INJOIGNABLE =
  "Le service est momentanément indisponible. Réessayez dans quelques instants, " +
  "ou découvrez le produit via la démonstration.";

/**
 * Appelle l'API en transformant une panne réseau en message lisible.
 *
 * Sans ce garde-fou, une API éteinte fait remonter l'exception de `fetch`
 * jusqu'à Next, qui affiche « Application error: a server-side exception has
 * occurred » — incompréhensible pour un visiteur, et désastreux sur un site
 * public où le premier contact se joue en quelques secondes.
 */
async function appelApi(
  chemin: string,
  corps: unknown,
): Promise<{ res: Response } | { erreur: string }> {
  try {
    const res = await fetch(`${API_URL}${chemin}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corps),
    });
    return { res };
  } catch {
    // DNS introuvable, connexion refusée, délai dépassé : dans tous les cas
    // le visiteur n'y peut rien et n'a pas à voir le détail technique.
    return { erreur: API_INJOIGNABLE };
  }
}

/** Extrait le message d'erreur métier renvoyé par l'API. */
async function messageApi(res: Response, defaut: string): Promise<string> {
  const b = (await res.json().catch(() => ({}))) as { message?: unknown };
  return typeof b.message === "string" ? b.message : defaut;
}

export async function login(formData: FormData): Promise<{ error?: string } | void> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const appel = await appelApi("/auth/login", { email, password });
  if ("erreur" in appel) return { error: appel.erreur };
  const { res } = appel;
  if (!res.ok) {
    return { error: await messageApi(res, "Email ou mot de passe incorrect.") };
  }
  const { token } = (await res.json()) as { token: string };
  cookies().set(SESSION_COOKIE, token, COOKIE_OPTS);
  redirect("/tableau-de-bord");
}

export async function signup(formData: FormData): Promise<{ error?: string } | void> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const nomAgence = String(formData.get("nomAgence") ?? "");

  const appel = await appelApi("/auth/signup", { email, password, nomAgence });
  if ("erreur" in appel) return { error: appel.erreur };
  const { res } = appel;
  if (!res.ok) {
    return {
      error: await messageApi(
        res,
        "Inscription impossible. Vérifiez vos informations (mot de passe : 8 caractères min).",
      ),
    };
  }
  const { token } = (await res.json()) as { token: string };
  cookies().set(SESSION_COOKIE, token, COOKIE_OPTS);
  redirect("/tableau-de-bord");
}

/**
 * Demande de réinitialisation. Le retour est volontairement identique que
 * l'email existe ou non — l'API ne le dit pas non plus. Ce formulaire est
 * public : il ne doit pas permettre de découvrir qui est client.
 */
export async function demanderReinitialisation(formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  const email = String(formData.get("email") ?? "");

  const appel = await appelApi("/auth/mot-de-passe-oublie", { email });
  if ("erreur" in appel) return { error: appel.erreur };
  if (!appel.res.ok) return { error: "Impossible d'envoyer l'email. Réessayez dans un instant." };
  return { ok: true };
}

export async function reinitialiserMotDePasse(formData: FormData): Promise<{ error?: string } | void> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  if (password !== confirmation) return { error: "Les deux mots de passe ne correspondent pas." };

  const appel = await appelApi("/auth/reinitialiser", { token, password });
  if ("erreur" in appel) return { error: appel.erreur };
  if (!appel.res.ok) {
    return { error: await messageApi(appel.res, "Ce lien est invalide ou a expiré. Refaites une demande.") };
  }
  redirect("/connexion?reinitialise=1");
}

export async function accepterInvitation(formData: FormData): Promise<{ error?: string } | void> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  if (password !== confirmation) return { error: "Les deux mots de passe ne correspondent pas." };

  const appel = await appelApi("/auth/invitation/accepter", { token, password });
  if ("erreur" in appel) return { error: appel.erreur };
  const { res } = appel;
  if (!res.ok) {
    return { error: await messageApi(res, "Cette invitation est invalide ou a expiré.") };
  }
  const { token: session } = (await res.json()) as { token: string };
  cookies().set(SESSION_COOKIE, session, COOKIE_OPTS);
  redirect("/tableau-de-bord");
}

export async function logout(): Promise<void> {
  cookies().delete(SESSION_COOKIE);
  redirect("/connexion");
}
