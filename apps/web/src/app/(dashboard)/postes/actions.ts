"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch, rethrowIfNavigation } from "@/lib/api";

/** Villes saisies via VillesInput : plusieurs champs de même nom. */
function lireVilles(formData: FormData): string[] {
  return formData
    .getAll("localisations")
    .map((v) => String(v).trim())
    .filter(Boolean)
    .slice(0, 8);
}

export async function createJob(formData: FormData) {
  const titre = String(formData.get("titre") ?? "").trim();
  const seniorite = String(formData.get("seniorite") ?? "").trim();
  const competences = String(formData.get("competences") ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  if (!titre) return;

  await apiFetch("/jobs", {
    method: "POST",
    body: JSON.stringify({
      titre,
      localisations: lireVilles(formData),
      seniorite: seniorite || undefined,
      competences,
    }),
  });

  revalidatePath("/postes");
}

export async function setValidation(candidateId: string, statut: "valide" | "rejete", jobId: string) {
  await apiFetch(`/candidates/${candidateId}/validation`, {
    method: "PATCH",
    body: JSON.stringify({ statut }),
  });
  revalidatePath(`/postes/${jobId}`);
}

/** Édition des critères. Ne relance pas la recherche (voir JobsService.update). */
export async function updateJob(jobId: string, formData: FormData): Promise<{ error?: string } | void> {
  const titre = String(formData.get("titre") ?? "").trim();
  const seniorite = String(formData.get("seniorite") ?? "").trim();
  const competences = String(formData.get("competences") ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  if (!titre) return { error: "L'intitulé du poste est obligatoire." };

  try {
    await apiFetch(`/jobs/${jobId}`, {
      method: "PUT",
      body: JSON.stringify({
        titre,
        // Envoyé même vide : c'est ce qui fait migrer un ancien poste
        // mono-ville vers le nouveau champ à la première modification.
        localisations: lireVilles(formData),
        seniorite: seniorite || undefined,
        competences,
      }),
    });
    revalidatePath(`/postes/${jobId}`);
    revalidatePath("/postes");
  } catch (err) {
    rethrowIfNavigation(err);
    return { error: "Enregistrement impossible." };
  }
}

export async function setJobStatus(jobId: string, statut: "ouvert" | "en_pause" | "clos") {
  await apiFetch(`/jobs/${jobId}/statut`, { method: "PATCH", body: JSON.stringify({ statut }) });
  revalidatePath(`/postes/${jobId}`);
  revalidatePath("/postes");
}

/** Nouvelle passe de sourcing sur un poste existant (consomme du quota). */
export async function relancerSourcing(jobId: string): Promise<{ error?: string } | void> {
  try {
    await apiFetch(`/jobs/${jobId}/relancer`, { method: "POST" });
    revalidatePath(`/postes/${jobId}`);
  } catch (err) {
    rethrowIfNavigation(err);
    return { error: "Relance impossible." };
  }
}

export async function deleteJob(jobId: string): Promise<{ error?: string } | void> {
  try {
    await apiFetch(`/jobs/${jobId}`, { method: "DELETE" });
  } catch (err) {
    rethrowIfNavigation(err);
    return { error: "Suppression impossible." };
  }
  revalidatePath("/postes");
  redirect("/postes");
}
