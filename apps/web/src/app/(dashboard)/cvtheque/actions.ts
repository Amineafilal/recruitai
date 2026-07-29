"use server";

import { revalidatePath } from "next/cache";
import { getSessionToken } from "@/lib/session";
import { apiFetch, rethrowIfNavigation } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface ImportResult {
  ok: boolean;
  message: string;
  /** Part des profils exploitables par l'enrichissement, pour l'avertissement. */
  avecLinkedin?: number;
  exploitables?: number;
}

export interface ImportPreview {
  lignesLues: number;
  exploitables: number;
  ignoresSansIdentifiant: number;
  doublonsDansLeFichier: number;
  avecLinkedin: number;
  avecEmail: number;
  colonnesReconnues: string[];
  colonnesIgnorees: string[];
  apercu: Record<string, string | undefined>[];
  blocageQuota: string | null;
}

/**
 * Analyse le CSV sans rien écrire. Le fichier transite par le serveur Next
 * (qui détient le jeton de session), comme pour l'import réel.
 */
export async function apercuCvtheque(
  formData: FormData,
): Promise<{ ok: true; preview: ImportPreview } | { ok: false; message: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Aucun fichier sélectionné." };
  }

  const relay = new FormData();
  relay.append("file", file);

  const res = await fetch(`${API_URL}/cvtheque/import/apercu`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getSessionToken()}` },
    body: relay,
  });

  if (!res.ok) {
    const detail = await res.text();
    return { ok: false, message: `Lecture impossible (${res.status}). ${detail.slice(0, 200)}` };
  }
  return { ok: true, preview: (await res.json()) as ImportPreview };
}

/**
 * Relaie le fichier CSV vers l'API avec le token Clerk. Le fichier transite
 * par le serveur Next (qui détient le token), jamais par le client — la clé
 * d'API n'est donc pas exposée au navigateur.
 */
export async function importCvtheque(formData: FormData): Promise<ImportResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Aucun fichier sélectionné." };
  }

  const token = getSessionToken();

  const relay = new FormData();
  relay.append("file", file);

  const res = await fetch(`${API_URL}/cvtheque/import`, {
    method: "POST",
    // pas de Content-Type : fetch pose la boundary multipart
    headers: { Authorization: `Bearer ${token}` },
    body: relay,
  });

  if (!res.ok) {
    const detail = await res.text();
    return { ok: false, message: `Import refusé (${res.status}). ${detail.slice(0, 160)}` };
  }

  const r = (await res.json()) as {
    lignesLues: number;
    importes: number;
    misAJour: number;
    ignoresSansIdentifiant: number;
    avecLinkedin: number;
  };
  revalidatePath("/cvtheque");
  return {
    ok: true,
    message: `${r.importes} profils importés, ${r.misAJour} mis à jour, ${r.ignoresSansIdentifiant} ignorés (sur ${r.lignesLues} lignes).`,
    avecLinkedin: r.avecLinkedin,
    exploitables: r.importes + r.misAJour,
  };
}

/** Charge le jeu de démonstration (admin uniquement, contrôlé par l'API). */
export async function chargerDemo(): Promise<{ error?: string; ok?: boolean }> {
  try {
    await apiFetch("/cvtheque/demo", { method: "POST" });
    revalidatePath("/cvtheque");
    return { ok: true };
  } catch (err) {
    rethrowIfNavigation(err);
    return { error: "Chargement de la démonstration impossible." };
  }
}

/** Retire les fiches de démonstration, et elles seules. */
export async function supprimerDemo(): Promise<{ error?: string; ok?: boolean }> {
  try {
    await apiFetch("/cvtheque/demo", { method: "DELETE" });
    revalidatePath("/cvtheque");
    return { ok: true };
  } catch (err) {
    rethrowIfNavigation(err);
    return { error: "Suppression de la démonstration impossible." };
  }
}
