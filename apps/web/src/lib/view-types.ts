// Formes de données côté UI. `profil` suit le schéma harvestapi renvoyé par
// l'actor Apify LinkedIn (voir apps/worker) ; on ne type que ce qu'on affiche.

// harvestapi renvoie certains champs sous forme { linkedinText: "..." } plutôt
// qu'en texte brut.
export type HarvestText = string | { linkedinText?: string; text?: string } | null | undefined;

export interface HarvestDate {
  year?: number;
  month?: number;
}

export interface HarvestPosition {
  title?: HarvestText;
  companyName?: HarvestText;
  description?: HarvestText;
  startedOn?: HarvestDate;
  endedOn?: HarvestDate;
  current?: boolean;
  /** Ancienneté dans le RÔLE. */
  tenureAtPosition?: { numYears?: number; numMonths?: number };
  /** Ancienneté dans l'ENTREPRISE, tous rôles confondus. */
  tenureAtCompany?: { numYears?: number; numMonths?: number };
}

/** Expérience nettoyée, prête à afficher. */
export interface ExperienceNormalisee {
  titre: string;
  entreprise: string;
  description: string;
  /** Durée dans le rôle, en mois. Null si indéterminable. */
  dureeMois: number | null;
  /** Durée dans l'entreprise, affichée seulement si elle diffère du rôle. */
  dureeEntrepriseMois: number | null;
  enCours: boolean;
}

function moisDepuisTenure(t?: { numYears?: number; numMonths?: number }): number | null {
  if (!t) return null;
  const y = t.numYears ?? 0;
  const m = t.numMonths ?? 0;
  const total = y * 12 + m;
  return total > 0 ? total : null;
}

/**
 * Durée calculée depuis les dates — source de vérité quand elles existent.
 * Les champs `tenure*` de l'actor sont des valeurs pré-calculées qui peuvent
 * être incohérentes entre elles ; les dates, elles, ne mentent pas.
 */
function moisDepuisDates(debut?: HarvestDate, fin?: HarvestDate, enCours?: boolean): number | null {
  if (!debut?.year) return null;
  const d = new Date(debut.year, (debut.month ?? 1) - 1);
  const f = enCours || !fin?.year ? new Date() : new Date(fin.year, (fin.month ?? 1) - 1);
  const mois = (f.getFullYear() - d.getFullYear()) * 12 + (f.getMonth() - d.getMonth());
  return mois >= 0 ? mois : null;
}

/** Clé de comparaison : entreprise + intitulé, insensible à la casse et aux espaces. */
function cleExperience(titre: string, entreprise: string): string {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  return `${norm(entreprise)}::${norm(titre)}`;
}

/**
 * Fusionne, dédoublonne et recalcule les expériences d'un profil.
 *
 * L'actor renvoie les expériences dans deux tableaux distincts (`experience`
 * et `currentPositions`) qui se recoupent : un poste actuel figure souvent
 * dans les deux. Les concaténer produit des lignes en double, avec des durées
 * qui semblent contradictoires parce que l'une porte sur le rôle et l'autre
 * sur l'entreprise.
 *
 * On dédoublonne donc sur entreprise + intitulé, et on garde la version la
 * plus complète de chaque doublon.
 */
export function experiencesNormalisees(profil: CandidateProfil): ExperienceNormalisee[] {
  const brutes = [...(profil.experience ?? []), ...(profil.currentPositions ?? [])];
  const parCle = new Map<string, ExperienceNormalisee>();

  for (const exp of brutes) {
    const titre = asText(exp.title);
    const entreprise = asText(exp.companyName);
    if (!titre && !entreprise) continue;

    // Priorité aux dates ; sinon on retombe sur la durée pré-calculée du rôle.
    const dureeMois = moisDepuisDates(exp.startedOn, exp.endedOn, exp.current) ?? moisDepuisTenure(exp.tenureAtPosition);
    const dureeEntrepriseMois = moisDepuisTenure(exp.tenureAtCompany);

    const candidate: ExperienceNormalisee = {
      titre,
      entreprise,
      description: asText(exp.description),
      dureeMois,
      dureeEntrepriseMois,
      enCours: Boolean(exp.current),
    };

    const cle = cleExperience(titre, entreprise);
    const existante = parCle.get(cle);
    if (!existante) {
      parCle.set(cle, candidate);
      continue;
    }

    // Doublon : on complète champ par champ plutôt que d'écraser, et on retient
    // la durée la plus longue — une entrée tronquée ne doit pas raccourcir une
    // entrée complète.
    parCle.set(cle, {
      titre: existante.titre || candidate.titre,
      entreprise: existante.entreprise || candidate.entreprise,
      description: existante.description || candidate.description,
      dureeMois: Math.max(existante.dureeMois ?? 0, candidate.dureeMois ?? 0) || null,
      dureeEntrepriseMois:
        Math.max(existante.dureeEntrepriseMois ?? 0, candidate.dureeEntrepriseMois ?? 0) || null,
      enCours: existante.enCours || candidate.enCours,
    });
  }

  // Les postes en cours d'abord, puis par durée décroissante.
  return [...parCle.values()].sort((a, b) => {
    if (a.enCours !== b.enCours) return a.enCours ? -1 : 1;
    return (b.dureeMois ?? 0) - (a.dureeMois ?? 0);
  });
}

const FORMAT_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Au moins 8 chiffres, éventuellement précédés d'un +. */
const FORMAT_TELEPHONE = /^\+?[\d][\d\s.\-()]{7,}$/;

/**
 * Cherche une valeur exploitable dans un objet dont on ne connaît pas le nom
 * exact des champs.
 *
 * Le mode « Full + email search » de l'actor ajoute un email au profil, mais
 * sa documentation ne précise pas sous quelle clé, et le quota du compte ne
 * permet pas de l'observer. Plutôt que de parier sur un nom, on parcourt le
 * profil sur une profondeur limitée en retenant la première valeur qui a la
 * FORME attendue — un email ressemble à un email, quel que soit son libellé.
 */
function chercherParForme(
  source: unknown,
  motifCle: RegExp,
  formatValeur: RegExp,
  profondeur = 3,
): string | null {
  if (profondeur < 0 || source === null || typeof source !== "object") return null;

  for (const [cle, valeur] of Object.entries(source as Record<string, unknown>)) {
    if (typeof valeur === "string") {
      const v = valeur.trim();
      // La clé DOIT correspondre : sans ce filtre, un email trouvé dans une
      // description de poste serait pris pour celui du candidat.
      if (motifCle.test(cle) && formatValeur.test(v)) return v;
    } else if (Array.isArray(valeur)) {
      for (const el of valeur) {
        if (typeof el === "string" && motifCle.test(cle) && formatValeur.test(el.trim())) {
          return el.trim();
        }
        const trouve = chercherParForme(el, motifCle, formatValeur, profondeur - 1);
        if (trouve) return trouve;
      }
    } else if (valeur && typeof valeur === "object") {
      const trouve = chercherParForme(valeur, motifCle, formatValeur, profondeur - 1);
      if (trouve) return trouve;
    }
  }
  return null;
}

/**
 * Coordonnées exploitables d'un candidat.
 *
 * Deux origines possibles : la CVthèque de l'agence (le candidat les a
 * fournies lui-même à l'import CSV), ou la recherche d'email de l'actor en
 * mode « Full + email search ». Le mode « Short », le moins cher, n'en
 * renvoie aucune.
 */
export function coordonneesCandidat(profil: CandidateProfil): {
  email: string | null;
  telephone: string | null;
} {
  return {
    email: chercherParForme(profil, /e?mail/i, FORMAT_EMAIL),
    telephone: chercherParForme(profil, /phone|tel|mobile|gsm/i, FORMAT_TELEPHONE),
  };
}

/** « 4 ans 11 mois », « 8 mois », « 2 ans ». */
export function dureeLisible(mois: number | null): string {
  if (!mois || mois <= 0) return "";
  const ans = Math.floor(mois / 12);
  const reste = mois % 12;
  const parts: string[] = [];
  if (ans > 0) parts.push(`${ans} an${ans > 1 ? "s" : ""}`);
  if (reste > 0) parts.push(`${reste} mois`);
  return parts.join(" ");
}

export interface HarvestEducation {
  schoolName?: HarvestText;
  degree?: HarvestText;
  fieldOfStudy?: HarvestText;
  period?: HarvestText;
}

export interface CandidateProfil {
  firstName?: string;
  lastName?: string;
  headline?: HarvestText;
  about?: HarvestText;
  linkedinUrl?: string;
  location?: HarvestText;
  pictureUrl?: string;
  currentPositions?: HarvestPosition[];
  experience?: HarvestPosition[];
  education?: HarvestEducation[];
  skills?: (HarvestText | { name?: HarvestText })[];
}

/** Libellé d'une compétence, que l'actor la renvoie en texte ou en objet. */
export function skillLabel(s: HarvestText | { name?: HarvestText }): string {
  if (s && typeof s === "object" && "name" in s) return asText(s.name);
  return asText(s as HarvestText);
}

export interface CandidateNoteView {
  id: string;
  contenu: string;
  auteurEmail: string;
  auteurUserId: string | null;
  createdAt: string;
}

export interface CandidateDetailView {
  candidat: SourcingCandidateView & { jobId: string; createdAt: string };
  poste: JobView | null;
  notes: CandidateNoteView[];
}

/** Extrait une chaîne d'un champ qui peut être un texte ou un objet {linkedinText}. */
export function asText(v: HarvestText): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  return v.linkedinText ?? v.text ?? "";
}

/**
 * Détail du score par critère. Miroir de CriteresEvalues de @recruitai/ai :
 * dupliqué ici pour que les composants client n'embarquent pas le paquet
 * serveur. Toute modification doit être répercutée des deux côtés.
 */
export interface CritereScoreView {
  note: number | null;
  commentaire: string;
}

export interface CriteresScoreView {
  competences: CritereScoreView;
  experience: CritereScoreView;
  seniorite: CritereScoreView;
  localisation: CritereScoreView;
}

/** Pondération affichée au recruteur — identique à CRITERES_SCORING. */
export const PONDERATION_SCORE = [
  { cle: "competences" as const, libelle: "Compétences demandées", poids: 0.4 },
  { cle: "experience" as const, libelle: "Expérience pertinente", poids: 0.25 },
  { cle: "seniorite" as const, libelle: "Niveau de séniorité", poids: 0.2 },
  { cle: "localisation" as const, libelle: "Localisation", poids: 0.15 },
];

/**
 * Le profil apporte-t-il autre chose que son intitulé ?
 *
 * Reprend la règle de `profilDocumente()` de @recruitai/ai, qui décide du
 * plafonnement au moment de la notation. Dupliquée ici — comme
 * `PONDERATION_SCORE` et `villesJob()` juste au-dessus — pour que le site
 * n'ait pas à dépendre du paquet de scoring, qui embarquerait les clients
 * Mistral et OpenAI dans le build pour dix lignes de logique.
 *
 * Si la règle change là-bas, la mettre à jour ici : sans quoi la fiche
 * candidat expliquerait un plafond qui ne s'applique plus, ou l'inverse.
 */
export function profilDocumente(brut: unknown): boolean {
  if (!brut || typeof brut !== "object") return false;
  const profil = brut as Record<string, unknown>;

  const postes = [
    ...(Array.isArray(profil.experience) ? profil.experience : []),
    ...(Array.isArray(profil.currentPositions) ? profil.currentPositions : []),
  ];
  const posteDetaille = postes.some((poste) => {
    if (!poste || typeof poste !== "object") return false;
    const o = poste as Record<string, unknown>;
    return Boolean(o.companyName || o.startedOn || o.tenureAtPosition || o.tenureAtCompany);
  });

  const formation = Array.isArray(profil.education) && profil.education.length > 0;
  const localisation =
    typeof profil.location === "string" ? profil.location.trim() !== "" : Boolean(profil.location);

  return posteDetaille || formation || localisation;
}

export interface SourcingCandidateView {
  id: string;
  source: string;
  /** Null quand le scoring a échoué — distinct d'un score de 0. */
  score: number | null;
  statutScoring?: "ok" | "echec" | "non_evaluable";
  scoringErreur?: string | null;
  scoringJustification?: string | null;
  scoringCriteres?: CriteresScoreView | null;
  scoringTentatives?: number;
  /** Étape du pipeline. Optionnel : les données de démo ne la portent pas. */
  etape?:
    | "source"
    | "a_valider"
    | "retenu"
    | "entretien_planifie"
    | "entretien_realise"
    | "offre_envoyee"
    | "embauche"
    | "rejete";
  /** @deprecated remplacé par `etape`, gardé synchronisé côté API. */
  statutValidation: string;
  profil: CandidateProfil;
}

export interface JobView {
  id: string;
  statut: string;
  createdAt: string;
  /** Issue du dernier sourcing. Null si aucune recherche n'a encore été lancée. */
  sourcingStatut?: "en_cours" | "termine" | "echec" | null;
  sourcingAt?: string | null;
  sourcingMessage?: string | null;
  sourcingCandidats?: number | null;
  criteres: {
    titre: string;
    competences: string[];
    /** @deprecated postes créés avant le multi-villes — lire via villesDuPoste(). */
    localisation?: string;
    localisations?: string[];
    seniorite?: string;
    /** Absent sur les postes créés avant l'ouverture aux autres secteurs. */
    secteur?: string;
  };
  // Optionnel : nombre de candidats en shortlist (agrégé côté liste).
  shortlistCount?: number;
}

/**
 * Villes d'un poste, ancienne ou nouvelle forme. Reprend la logique de
 * villesDuPoste() de @recruitai/types ; dupliquée ici pour que les composants
 * client n'aient pas à importer le paquet serveur.
 */
export function villesJob(criteres: JobView["criteres"]): string[] {
  if (criteres.localisations?.length) return criteres.localisations;
  return criteres.localisation ? [criteres.localisation] : [];
}

export interface CvthequeProfileView {
  id: string;
  statutChaud: boolean;
  dernierEnrichissementAt: string | null;
  contact: {
    prenom?: string;
    nom?: string;
    email?: string;
    poste?: string;
    entreprise?: string;
    localisation?: string;
    linkedinUrl?: string;
  };
}

export function candidateName(p: CandidateProfil): string {
  return [p.firstName, p.lastName].filter(Boolean).join(" ") || "Candidat";
}

export function candidateTitle(p: CandidateProfil): string {
  const pos = p.currentPositions?.[0];
  if (!pos) return "";
  return [asText(pos.title), asText(pos.companyName)].filter(Boolean).join(" · ");
}

export function candidateLocation(p: CandidateProfil): string {
  return asText(p.location);
}

export function initials(p: CandidateProfil): string {
  return `${p.firstName?.[0] ?? ""}${p.lastName?.[0] ?? ""}`.toUpperCase() || "?";
}
