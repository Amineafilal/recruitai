"use server";

import { revalidatePath } from "next/cache";
import { apiFetch, rethrowIfNavigation } from "@/lib/api";
import type { Etape } from "@/lib/pipeline";

/**
 * Déplace un candidat dans le pipeline.
 *
 * Renvoie l'erreur plutôt que de la lever : le tableau applique le
 * déplacement de façon optimiste et a besoin de savoir s'il doit revenir en
 * arrière.
 */
export async function deplacerCandidat(
  candidateId: string,
  etape: Etape,
  jobId: string,
): Promise<{ error?: string } | void> {
  try {
    await apiFetch(`/candidates/${candidateId}/etape`, {
      method: "PATCH",
      body: JSON.stringify({ etape }),
    });
    revalidatePath(`/postes/${jobId}`);
  } catch (err) {
    rethrowIfNavigation(err);
    return { error: "Déplacement impossible. Le candidat est resté à son étape précédente." };
  }
}
