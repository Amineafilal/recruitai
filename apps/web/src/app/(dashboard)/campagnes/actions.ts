"use server";

import { revalidatePath } from "next/cache";
import { apiFetch, rethrowIfNavigation } from "@/lib/api";

export interface ActionResult {
  ok: boolean;
  message?: string;
}

export async function createCampaign(formData: FormData): Promise<ActionResult> {
  const nom = String(formData.get("campagneNom") ?? "").trim();
  const sujet = String(formData.get("campagneSujet") ?? "").trim();
  const template = String(formData.get("template") ?? "").trim();
  const declencheur = String(formData.get("declencheur") ?? "manuel").trim();
  const delaiMinRelanceJours = Number(formData.get("delaiMinRelanceJours") ?? 90);

  if (!nom || !sujet || !template) {
    return { ok: false, message: "Nom, sujet et message sont obligatoires." };
  }

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/campagnes`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ nom, sujet, template, declencheur, delaiMinRelanceJours }),
  });

  if (!res.ok) {
    return { ok: false, message: `Création refusée (${res.status}). ${(await res.text()).slice(0, 160)}` };
  }
  revalidatePath("/campagnes");
  return { ok: true };
}

export async function setCampaignStatus(id: string, statut: "actif" | "pause"): Promise<void> {
  await apiFetch(`/campagnes/${id}/statut`, {
    method: "PATCH",
    body: JSON.stringify({ statut }),
  });
  revalidatePath("/campagnes");
}

export async function updateCampaign(id: string, formData: FormData): Promise<ActionResult> {
  const nom = String(formData.get("campagneNom") ?? "").trim();
  const sujet = String(formData.get("campagneSujet") ?? "").trim();
  const template = String(formData.get("template") ?? "").trim();
  const declencheur = String(formData.get("declencheur") ?? "manuel").trim();
  const delaiMinRelanceJours = Number(formData.get("delaiMinRelanceJours") ?? 90);

  if (!nom || !sujet || !template) {
    return { ok: false, message: "Nom, sujet et message sont obligatoires." };
  }

  try {
    await apiFetch(`/campagnes/${id}`, {
      method: "PUT",
      body: JSON.stringify({ nom, sujet, template, declencheur, delaiMinRelanceJours }),
    });
    revalidatePath("/campagnes");
    return { ok: true };
  } catch (err) {
    rethrowIfNavigation(err);
    return { ok: false, message: "Enregistrement impossible." };
  }
}

export async function deleteCampaign(id: string): Promise<ActionResult> {
  try {
    await apiFetch(`/campagnes/${id}`, { method: "DELETE" });
    revalidatePath("/campagnes");
    return { ok: true };
  } catch (err) {
    rethrowIfNavigation(err);
    return { ok: false, message: "Suppression impossible." };
  }
}

/**
 * Envoi immédiat, sans attendre le cron de 09:00. Les mêmes garde-fous RGPD
 * s'appliquent (opt-out, délai anti-relance) : ce bouton ne permet pas de
 * forcer un envoi à quelqu'un qui s'est désinscrit.
 */
export async function envoyerMaintenant(id: string): Promise<ActionResult & { envoyes?: number }> {
  try {
    const res = await apiFetch<{ envoyes: number; echecs: number }>(`/campagnes/${id}/envoyer`, {
      method: "POST",
    });
    revalidatePath("/campagnes");
    return { ok: true, envoyes: res.envoyes };
  } catch (err) {
    rethrowIfNavigation(err);
    return { ok: false, message: "Envoi impossible." };
  }
}

// En-têtes authentifiés via la session interne (JWT en cookie).
async function authHeaders(): Promise<Record<string, string>> {
  const { getSessionToken } = await import("@/lib/session");
  return {
    Authorization: `Bearer ${getSessionToken()}`,
    "Content-Type": "application/json",
  };
}
