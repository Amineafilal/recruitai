import { z } from "zod";

export const JobStatus = z.enum(["ouvert", "en_pause", "clos"]);
export type JobStatus = z.infer<typeof JobStatus>;

/**
 * Plafond de villes par poste. Chaque ville déclenche une recherche distincte
 * chez le fournisseur de scraping : sans limite, un poste avec trente villes
 * viderait le quota mensuel en une seule exécution.
 */
export const MAX_VILLES_PAR_POSTE = 8;

export const JobCriteriaSchema = z.object({
  titre: z.string().min(1),
  competences: z.array(z.string()).default([]),
  /**
   * @deprecated Conservé en lecture seule pour les postes créés avant le
   * multi-villes. Les écritures renseignent `localisations`. Passer par
   * villesDuPoste() plutôt que de lire ce champ directement.
   */
  localisation: z.string().optional(),
  localisations: z.array(z.string().min(1)).max(MAX_VILLES_PAR_POSTE).default([]),
  seniorite: z.enum(["junior", "confirme", "senior", "lead"]).optional(),
  fourchetteSalarialeMin: z.number().int().nonnegative().optional(),
  fourchetteSalarialeMax: z.number().int().nonnegative().optional(),
});
export type JobCriteria = z.infer<typeof JobCriteriaSchema>;

/**
 * Villes d'un poste, quelle que soit l'époque à laquelle il a été créé.
 * Les anciens postes n'ont qu'un champ `localisation` ; les nouveaux ont
 * `localisations`. Tout le code applicatif doit passer par ici pour ne pas
 * avoir à connaître cette différence.
 */
export function villesDuPoste(criteres: {
  localisation?: string;
  localisations?: string[];
}): string[] {
  if (criteres.localisations?.length) return criteres.localisations;
  return criteres.localisation ? [criteres.localisation] : [];
}

export const JobSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  criteres: JobCriteriaSchema,
  statut: JobStatus,
  createdAt: z.coerce.date(),
});
export type Job = z.infer<typeof JobSchema>;
