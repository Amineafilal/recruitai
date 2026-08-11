/**
 * Ramène un profil brut, quel que soit l'actor qui l'a produit, à la forme
 * unique attendue par le reste de l'application.
 *
 * Chaque actor LinkedIn a son propre vocabulaire : harvestapi expose
 * `currentPositions[]` et `location: {linkedinText}`, fabri-lab expose
 * `currentPosition`, `currentTitle`, `currentCompany` et `locationText`.
 * Sans cette couche, changer d'actor imposerait de retoucher l'affichage, le
 * scoring et la fiche candidat — et les anciens candidats deviendraient
 * illisibles.
 *
 * La forme canonique retenue est celle de harvestapi, puisque les 44 candidats
 * déjà en base la respectent : un profil normalisé et un profil historique
 * s'affichent donc identiquement.
 */

interface Position {
  title?: unknown;
  companyName?: unknown;
  description?: unknown;
  startedOn?: unknown;
  endedOn?: unknown;
  current?: boolean;
  tenureAtPosition?: unknown;
  tenureAtCompany?: unknown;
}

export interface ProfilCanonique {
  firstName?: string;
  lastName?: string;
  headline?: unknown;
  about?: unknown;
  linkedinUrl?: string;
  location?: unknown;
  pictureUrl?: string;
  currentPositions?: Position[];
  experience?: Position[];
  education?: unknown[];
  skills?: unknown[];
  /** Tout le reste du profil brut, conservé pour ne rien perdre. */
  [autre: string]: unknown;
}

/** Première valeur non vide parmi les candidates. */
function premier(...valeurs: unknown[]): unknown {
  for (const v of valeurs) {
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    return v;
  }
  return undefined;
}

function chaine(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const t = o.linkedinText ?? o.text ?? o.name;
    if (typeof t === "string" && t.trim()) return t.trim();
  }
  return undefined;
}

/**
 * Construit un poste courant quand l'actor ne fournit que des champs plats
 * (`currentTitle` + `currentCompany`) au lieu d'un tableau structuré.
 * Sans ça, la fiche candidat n'afficherait aucune expérience.
 */
function positionDepuisChampsPlats(p: Record<string, unknown>): Position[] {
  const titre = chaine(premier(p.currentTitle, p.jobTitle, p.currentPosition, p.title));
  const entreprise = chaine(premier(p.currentCompany, p.company, p.companyName));
  if (!titre && !entreprise) return [];
  return [{ title: titre, companyName: entreprise, current: true }];
}

export function normaliserProfil(brut: unknown): ProfilCanonique {
  if (!brut || typeof brut !== "object") return {};
  const p = brut as Record<string, unknown>;

  // Certains actors ne renvoient que `fullName` : on le découpe pour que
  // l'affichage du nom et les initiales fonctionnent partout.
  let prenom = chaine(p.firstName);
  let nom = chaine(p.lastName);
  if (!prenom && !nom) {
    const complet = chaine(p.fullName ?? p.name);
    if (complet) {
      const parts = complet.split(/\s+/);
      prenom = parts[0];
      nom = parts.slice(1).join(" ") || undefined;
    }
  }

  const positions = Array.isArray(p.currentPositions) && p.currentPositions.length > 0
    ? (p.currentPositions as Position[])
    : positionDepuisChampsPlats(p);

  return {
    // Le profil brut est conservé en dessous : aucune donnée n'est perdue,
    // et un champ oublié aujourd'hui reste exploitable demain.
    ...p,
    firstName: prenom,
    lastName: nom,
    headline: premier(p.headline, p.currentTitle, p.jobTitle, p.profileSummary),
    about: premier(p.about, p.summary, p.profileSummary),
    linkedinUrl: chaine(premier(p.linkedinUrl, p.profileUrl, p.url)),
    location: premier(p.location, p.locationText, p.locationName),
    pictureUrl: chaine(premier(p.pictureUrl, p.profilePicture, p.photo)),
    currentPositions: positions,
    experience: Array.isArray(p.experience) ? (p.experience as Position[]) : [],
    education: Array.isArray(p.education) ? p.education : [],
    skills: Array.isArray(p.skills) && p.skills.length > 0
      ? p.skills
      : Array.isArray(p.topSkills)
        ? p.topSkills
        : [],
  };
}
