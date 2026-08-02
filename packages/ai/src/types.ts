import { z } from "zod";
import type { JobCriteria } from "@recruitai/types";

export interface ScoringInput {
  criteres: JobCriteria;
  profil: unknown;
}

/**
 * Critères composant la note, avec leur poids.
 *
 * Les poids sont FIXES et connus à l'avance : le score global est leur moyenne
 * pondérée, pas un jugement global de l'IA. C'est ce qui rend la note
 * explicable — un recruteur peut refaire le calcul à la main et comprendre
 * pourquoi un profil obtient 72 plutôt que 85.
 *
 * Laisser l'IA produire à la fois un total ET un détail serait pire que rien :
 * les deux finiraient par se contredire, et le recruteur cesserait de croire
 * aux deux.
 */
export const CRITERES_SCORING = [
  {
    cle: "competences",
    libelle: "Compétences demandées",
    poids: 0.4,
    aide: "Part des compétences du poste réellement prouvées dans le profil",
  },
  {
    cle: "experience",
    libelle: "Expérience pertinente",
    poids: 0.25,
    aide: "Ancienneté et pertinence des postes occupés au regard du poste visé",
  },
  {
    cle: "seniorite",
    libelle: "Niveau de séniorité",
    poids: 0.2,
    aide: "Adéquation avec le niveau attendu (junior, confirmé, senior, lead)",
  },
  {
    cle: "localisation",
    libelle: "Localisation",
    poids: 0.15,
    aide: "Proximité avec les villes du poste",
  },
] as const;

export type CleCritere = (typeof CRITERES_SCORING)[number]["cle"];

/**
 * Évaluation d'un critère. `note` à null signifie « non applicable » : un
 * poste sans ville demandée ne peut pas juger la localisation. Le poids du
 * critère est alors redistribué sur les autres plutôt que compté comme zéro,
 * ce qui pénaliserait injustement tous les candidats.
 */
export const CritereEvalueSchema = z.object({
  note: z.number().min(0).max(100).nullable(),
  commentaire: z.string().max(300),
});
export type CritereEvalue = z.infer<typeof CritereEvalueSchema>;

export const CriteresEvaluesSchema = z.object({
  competences: CritereEvalueSchema,
  experience: CritereEvalueSchema,
  seniorite: CritereEvalueSchema,
  localisation: CritereEvalueSchema,
});
export type CriteresEvalues = z.infer<typeof CriteresEvaluesSchema>;

/** Ce que le fournisseur d'IA doit renvoyer. Le total, lui, est calculé. */
export const ReponseIaSchema = z.object({
  criteres: CriteresEvaluesSchema,
  synthese: z.string().max(400),
});

export interface ScoringResult {
  /** Moyenne pondérée des critères, arrondie. */
  score: number;
  /** Phrase de synthèse, conservée pour l'affichage résumé. */
  justification: string;
  /** Détail par critère, pour expliquer la note au recruteur. */
  criteres: CriteresEvalues;
}

/**
 * Calcule le score global à partir des critères évalués.
 *
 * Les critères non applicables (note null) sont exclus du calcul ET du total
 * des poids : c'est ce qui évite qu'un poste sans ville renseignée plafonne
 * mécaniquement tous ses candidats à 85.
 */
/**
 * Marge maximale au-dessus de la note de compétences.
 *
 * Une moyenne pondérée seule ne sait pas exprimer qu'un critère est
 * éliminatoire : un candidat sans AUCUNE des compétences demandées obtenait
 * 48/100 en cumulant la bonne ville et la bonne séniorité. Aucun recruteur
 * n'accepterait ce classement.
 *
 * Ce plafond traduit une règle métier simple : le reste du profil peut
 * rehausser une note, jamais compenser l'absence du savoir-faire recherché.
 */
const MARGE_AU_DESSUS_DES_COMPETENCES = 25;

export function calculerScore(criteres: CriteresEvalues): number {
  let somme = 0;
  let poidsTotal = 0;

  for (const { cle, poids } of CRITERES_SCORING) {
    const note = criteres[cle]?.note;
    if (note === null || note === undefined) continue;
    somme += note * poids;
    poidsTotal += poids;
  }

  // Aucun critère évaluable : on ne peut pas prétendre noter ce profil.
  if (poidsTotal === 0) return 0;
  const moyenne = somme / poidsTotal;

  const noteCompetences = criteres.competences?.note;
  if (noteCompetences === null || noteCompetences === undefined) {
    return Math.round(moyenne);
  }
  return Math.round(Math.min(moyenne, noteCompetences + MARGE_AU_DESSUS_DES_COMPETENCES));
}

/** Vrai si la note a été bornée par l'absence de compétences, pour l'afficher. */
export function scorePlafonne(criteres: CriteresEvalues): boolean {
  const note = criteres.competences?.note;
  if (note === null || note === undefined) return false;

  let somme = 0;
  let poidsTotal = 0;
  for (const { cle, poids } of CRITERES_SCORING) {
    const n = criteres[cle]?.note;
    if (n === null || n === undefined) continue;
    somme += n * poids;
    poidsTotal += poids;
  }
  if (poidsTotal === 0) return false;
  return somme / poidsTotal > note + MARGE_AU_DESSUS_DES_COMPETENCES;
}

export interface ScoringProvider {
  name: string;
  score(input: ScoringInput): Promise<ScoringResult>;
}
