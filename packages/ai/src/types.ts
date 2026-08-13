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
  /**
   * Moyenne pondérée des critères, arrondie. `null` quand AUCUN critère
   * n'était évaluable : l'appel à l'IA a abouti, mais le profil ne contenait
   * rien à noter. À distinguer d'un scoring en panne, qui mérite un réessai.
   */
  score: number | null;
  /**
   * Vrai quand le total a été ramené à PLAFOND_PROFIL_NON_DOCUMENTE faute de
   * données vérifiables. Le recruteur doit pouvoir lire pourquoi un profil aux
   * composantes maximales n'affiche pas 100.
   */
  plafonneParDocumentation?: boolean;
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

/**
 * Plafond d'un profil dont rien n'est vérifiable au-delà de son intitulé.
 *
 * Les sources gratuites ne renvoient souvent qu'une ligne de titre : ni
 * employeurs, ni dates, ni formation. L'IA note alors l'expérience ET la
 * séniorité à partir de la même phrase, et un « Data Analyst | PL-300
 * Certified » ressort à 100/100 sans qu'aucune de ces deux notes repose sur
 * un fait vérifiable.
 *
 * 85 et non moins : la valeur laisse le classement intact — seuls les profils
 * qui dépassaient ce seuil sont ramenés — tout en réservant la tranche haute,
 * celle qu'un recruteur lit comme « candidat idéal », aux profils réellement
 * documentés. Un titre qui colle n'est pas une candidature excellente.
 */
export const PLAFOND_PROFIL_NON_DOCUMENTE = 85;

/**
 * Vrai si le profil apporte autre chose que son intitulé : un poste avec son
 * employeur ou ses dates, une formation, ou une localisation renseignée par
 * la source.
 *
 * Le texte de présentation ne compte PAS : un candidat y écrit ce qu'il veut,
 * et c'est précisément la matière que l'IA paraphrase déjà.
 */
export function profilDocumente(profil: unknown): boolean {
  if (!profil || typeof profil !== "object") return false;
  const p = profil as Record<string, unknown>;

  const postes = [
    ...(Array.isArray(p.experience) ? p.experience : []),
    ...(Array.isArray(p.currentPositions) ? p.currentPositions : []),
  ];
  // Un poste réduit à son titre n'apprend rien de plus que le headline.
  const posteDetaille = postes.some((poste) => {
    if (!poste || typeof poste !== "object") return false;
    const o = poste as Record<string, unknown>;
    return Boolean(o.companyName || o.startedOn || o.tenureAtPosition || o.tenureAtCompany);
  });

  const formation = Array.isArray(p.education) && p.education.length > 0;
  const localisation = typeof p.location === "string" ? p.location.trim() !== "" : Boolean(p.location);

  return posteDetaille || formation || localisation;
}

export function calculerScore(criteres: CriteresEvalues): number | null {
  let somme = 0;
  let poidsTotal = 0;

  for (const { cle, poids } of CRITERES_SCORING) {
    const note = criteres[cle]?.note;
    if (note === null || note === undefined) continue;
    somme += note * poids;
    poidsTotal += poids;
  }

  // Aucun critère évaluable : ce profil n'est pas notable, et le dire vaut
  // mieux que de renvoyer 0.
  //
  // Renvoyer 0 affirmait exactement le contraire du commentaire qui précédait
  // cette ligne : que le candidat avait été jugé, et jugé nul. Trois profils
  // sans la moindre donnée exploitable se retrouvaient ainsi classés derniers,
  // à égalité avec ceux à qui il manquait réellement la compétence demandée.
  if (poidsTotal === 0) return null;
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
