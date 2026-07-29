"use server";

import { revalidatePath } from "next/cache";
import { apiFetch, rethrowIfNavigation } from "@/lib/api";

export async function ajouterNote(
  candidateId: string,
  jobId: string,
  contenu: string,
): Promise<{ error?: string } | void> {
  const texte = contenu.trim();
  if (!texte) return { error: "La note est vide." };

  try {
    await apiFetch(`/candidates/${candidateId}/notes`, {
      method: "POST",
      body: JSON.stringify({ contenu: texte }),
    });
    revalidatePath(`/postes/${jobId}/candidats/${candidateId}`);
  } catch (err) {
    rethrowIfNavigation(err);
    return { error: "Impossible d'enregistrer la note." };
  }
}

export async function supprimerNote(
  noteId: string,
  candidateId: string,
  jobId: string,
): Promise<{ error?: string } | void> {
  try {
    await apiFetch(`/notes/${noteId}`, { method: "DELETE" });
    revalidatePath(`/postes/${jobId}/candidats/${candidateId}`);
  } catch (err) {
    rethrowIfNavigation(err);
    return { error: "Suppression impossible." };
  }
}

export async function definirValidation(
  candidateId: string,
  jobId: string,
  statut: "valide" | "rejete" | "a_valider",
): Promise<void> {
  await apiFetch(`/candidates/${candidateId}/validation`, {
    method: "PATCH",
    body: JSON.stringify({ statut }),
  });
  revalidatePath(`/postes/${jobId}/candidats/${candidateId}`);
  revalidatePath(`/postes/${jobId}`);
}

/** Consigne un appel dans la timeline du candidat. */
export async function loggerAppel(
  candidateId: string,
  jobId: string,
  resume: string,
  details: string,
): Promise<{ error?: string } | void> {
  if (!resume.trim()) return { error: "Indiquez l'issue de l'appel." };
  try {
    await apiFetch(`/candidates/${candidateId}/appels`, {
      method: "POST",
      body: JSON.stringify({ resume, details: details || undefined }),
    });
    revalidatePath(`/postes/${jobId}/candidats/${candidateId}`);
  } catch (err) {
    rethrowIfNavigation(err);
    return { error: "Enregistrement de l'appel impossible." };
  }
}
