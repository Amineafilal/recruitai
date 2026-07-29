"use server";

import { revalidatePath } from "next/cache";
import { apiFetch, rethrowIfNavigation } from "@/lib/api";

export interface ProfilResult {
  ok?: boolean;
  error?: string;
}

export async function changerMotDePasse(formData: FormData): Promise<ProfilResult> {
  const ancien = String(formData.get("ancien") ?? "");
  const nouveau = String(formData.get("nouveau") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  if (nouveau !== confirmation) return { error: "Les deux nouveaux mots de passe ne correspondent pas." };
  if (nouveau.length < 8) return { error: "Le nouveau mot de passe doit faire au moins 8 caractères." };

  try {
    await apiFetch("/auth/mot-de-passe", {
      method: "PATCH",
      body: JSON.stringify({ ancien, nouveau }),
    });
    return { ok: true };
  } catch (err) {
    rethrowIfNavigation(err);
    return { error: messageApi(err, "Changement impossible.") };
  }
}

export async function renommerAgence(formData: FormData): Promise<ProfilResult> {
  const nom = String(formData.get("nom") ?? "").trim();
  if (!nom) return { error: "Le nom de l'agence est obligatoire." };

  try {
    await apiFetch("/auth/agence", { method: "PATCH", body: JSON.stringify({ nom }) });
    // Le nom d'agence est affiché dans l'en-tête de toutes les pages.
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    rethrowIfNavigation(err);
    return { error: messageApi(err, "Renommage impossible.") };
  }
}

/** Extrait le message métier renvoyé par l'API du message d'erreur d'apiFetch. */
function messageApi(err: unknown, defaut: string): string {
  const brut = err instanceof Error ? err.message : "";
  const debut = brut.indexOf("{");
  if (debut === -1) return defaut;
  try {
    const corps = JSON.parse(brut.slice(debut)) as { message?: unknown };
    if (typeof corps.message === "string") return corps.message;
    // Erreurs de validation Zod : { fieldErrors: { nouveau: ["…"] } }
    const champs = (corps as { fieldErrors?: Record<string, string[]> }).fieldErrors;
    const premier = champs && Object.values(champs).flat()[0];
    if (typeof premier === "string") return premier;
  } catch {
    // Réponse non-JSON : message générique.
  }
  return defaut;
}
