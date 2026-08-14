"use server";

import { revalidatePath } from "next/cache";
import { ApiError, apiFetch, rethrowIfNavigation } from "@/lib/api";

/**
 * L'invitation est toujours créée. Si l'email n'a pas pu partir, l'API renvoie
 * le lien et la raison : l'écran les affiche pour que l'administrateur puisse
 * transmettre l'invitation lui-même plutôt que de la perdre.
 */
export async function inviterMembre(
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; lien?: string | null; raison?: string }> {
  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "recruteur");
  if (!email) return { error: "Renseignez un email." };

  try {
    const res = await apiFetch<{ email: string; lien: string | null; envoye: boolean; raison?: string }>(
      "/equipe/invitations",
      { method: "POST", body: JSON.stringify({ email, role }) },
    );
    revalidatePath("/equipe");
    return { ok: true, lien: res.lien, raison: res.raison };
  } catch (err) {
    return { error: messageErreur(err, "Invitation impossible.") };
  }
}

export async function revoquerInvitation(id: string): Promise<{ error?: string } | void> {
  try {
    await apiFetch(`/equipe/invitations/${id}`, { method: "DELETE" });
    revalidatePath("/equipe");
  } catch (err) {
    return { error: messageErreur(err, "Révocation impossible.") };
  }
}

export async function retirerMembre(id: string): Promise<{ error?: string } | void> {
  try {
    await apiFetch(`/equipe/membres/${id}`, { method: "DELETE" });
    revalidatePath("/equipe");
  } catch (err) {
    return { error: messageErreur(err, "Retrait impossible.") };
  }
}

export async function changerRole(id: string, role: "admin" | "recruteur"): Promise<{ error?: string } | void> {
  try {
    await apiFetch(`/equipe/membres/${id}`, { method: "PATCH", body: JSON.stringify({ role }) });
    revalidatePath("/equipe");
  } catch (err) {
    return { error: messageErreur(err, "Changement de rôle impossible.") };
  }
}

/**
 * apiFetch encapsule la réponse d'erreur dans le message de l'Error. On en
 * ré-extrait le message métier de l'API (« L'agence doit conserver au moins
 * un administrateur », etc.) pour l'afficher tel quel plutôt qu'un code HTTP.
 */
function messageErreur(err: unknown, defaut: string): string {
  rethrowIfNavigation(err);
  // ApiError porte le message rédigé par l'API. Cette fonction le redécoupait
  // elle-même à partir du premier « { » de la chaîne d'erreur — une heuristique
  // qui se serait cassée sur un chemin d'URL contenant une accolade.
  if (err instanceof ApiError) return err.messageUtilisateur;
  return defaut;
}
