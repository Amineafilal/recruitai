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

export async function login(formData: FormData): Promise<{ error?: string } | void> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const b = (await res.json().catch(() => ({}))) as { message?: string };
    return { error: b.message ?? "Email ou mot de passe incorrect." };
  }
  const { token } = (await res.json()) as { token: string };
  cookies().set(SESSION_COOKIE, token, COOKIE_OPTS);
  redirect("/tableau-de-bord");
}

export async function signup(formData: FormData): Promise<{ error?: string } | void> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const nomAgence = String(formData.get("nomAgence") ?? "");

  const res = await fetch(`${API_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, nomAgence }),
  });
  if (!res.ok) {
    const b = (await res.json().catch(() => ({}))) as { message?: string };
    const msg =
      typeof b.message === "string"
        ? b.message
        : "Inscription impossible. Vérifiez vos informations (mot de passe : 8 caractères min).";
    return { error: msg };
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

  const res = await fetch(`${API_URL}/auth/mot-de-passe-oublie`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) return { error: "Impossible d'envoyer l'email. Réessayez dans un instant." };
  return { ok: true };
}

export async function reinitialiserMotDePasse(formData: FormData): Promise<{ error?: string } | void> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  if (password !== confirmation) return { error: "Les deux mots de passe ne correspondent pas." };

  const res = await fetch(`${API_URL}/auth/reinitialiser`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  if (!res.ok) {
    const b = (await res.json().catch(() => ({}))) as { message?: string };
    return {
      error:
        typeof b.message === "string" ? b.message : "Ce lien est invalide ou a expiré. Refaites une demande.",
    };
  }
  redirect("/connexion?reinitialise=1");
}

export async function accepterInvitation(formData: FormData): Promise<{ error?: string } | void> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  if (password !== confirmation) return { error: "Les deux mots de passe ne correspondent pas." };

  const res = await fetch(`${API_URL}/auth/invitation/accepter`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  if (!res.ok) {
    const b = (await res.json().catch(() => ({}))) as { message?: string };
    return {
      error: typeof b.message === "string" ? b.message : "Cette invitation est invalide ou a expiré.",
    };
  }
  const { token: session } = (await res.json()) as { token: string };
  cookies().set(SESSION_COOKIE, session, COOKIE_OPTS);
  redirect("/tableau-de-bord");
}

export async function logout(): Promise<void> {
  cookies().delete(SESSION_COOKIE);
  redirect("/connexion");
}
