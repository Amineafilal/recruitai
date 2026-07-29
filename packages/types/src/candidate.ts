import { z } from "zod";

/**
 * Étapes du pipeline de recrutement, dans l'ordre d'avancement.
 *
 * `source` est l'entrée automatique (l'agent a trouvé le profil, personne ne
 * l'a encore regardé) ; `a_valider` signifie qu'un recruteur l'a mis de côté
 * pour décision ; `retenu` qu'il est approuvé. `embauche` et `rejete` sont les
 * deux sorties définitives.
 */
export const PIPELINE_STAGES = [
  "source",
  "a_valider",
  "retenu",
  "entretien_planifie",
  "entretien_realise",
  "offre_envoyee",
  "embauche",
  "rejete",
] as const;

export const PipelineStage = z.enum(PIPELINE_STAGES);
export type PipelineStage = z.infer<typeof PipelineStage>;

export const PIPELINE_LABELS: Record<PipelineStage, string> = {
  source: "Sourcé",
  a_valider: "À valider",
  retenu: "Retenu",
  entretien_planifie: "Entretien planifié",
  entretien_realise: "Entretien réalisé",
  offre_envoyee: "Offre envoyée",
  embauche: "Embauché",
  rejete: "Rejeté",
};

/** Étapes qui clôturent le parcours : plus rien n'est attendu du recruteur. */
export const ETAPES_TERMINALES: PipelineStage[] = ["embauche", "rejete"];

/**
 * Correspondance vers l'ancien champ `statut_validation`, conservé synchronisé
 * le temps que le pipeline soit éprouvé. Voir la migration 0006.
 */
export function statutValidationPour(etape: PipelineStage): "a_valider" | "valide" | "rejete" {
  if (etape === "rejete") return "rejete";
  if (etape === "source" || etape === "a_valider") return "a_valider";
  return "valide";
}
import { ScrapeSource } from "./scraping.js";

export const ValidationStatus = z.enum(["a_valider", "valide", "rejete"]);
export type ValidationStatus = z.infer<typeof ValidationStatus>;

export const SourcingCandidateSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  jobId: z.string().uuid(),
  source: ScrapeSource,
  score: z.number().min(0).max(100),
  statutValidation: ValidationStatus,
  profil: z.unknown(),
  createdAt: z.coerce.date(),
});
export type SourcingCandidate = z.infer<typeof SourcingCandidateSchema>;

export const CvthequeProfileSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  contact: z.unknown(),
  statutChaud: z.boolean().default(false),
  dernierEnrichissementAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});
export type CvthequeProfile = z.infer<typeof CvthequeProfileSchema>;

export const SignalType = z.enum(["changement_poste", "nouveau_diplome", "activite"]);
export type SignalType = z.infer<typeof SignalType>;

export const SignalSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  profileId: z.string().uuid(),
  type: SignalType,
  detecteAt: z.coerce.date(),
});
export type Signal = z.infer<typeof SignalSchema>;
