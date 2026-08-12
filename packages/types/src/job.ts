import { z } from "zod";

export const JobStatus = z.enum(["ouvert", "en_pause", "clos"]);
export type JobStatus = z.infer<typeof JobStatus>;

/**
 * Plafond de villes par poste. Chaque ville déclenche une recherche distincte
 * chez le fournisseur de scraping : sans limite, un poste avec trente villes
 * viderait le quota mensuel en une seule exécution.
 */
export const MAX_VILLES_PAR_POSTE = 8;

/**
 * Secteurs d'activité proposés à la création d'un poste.
 *
 * Le produit a été construit sur des postes tech, et tout le formulaire le
 * trahissait : « Développeur React », « React, TypeScript, Next.js ». Un
 * cabinet qui recrute des infirmiers ou des chefs de rang en concluait que
 * l'outil n'était pas pour lui.
 *
 * Le choix des secteurs vise le marché réel — Maroc et Europe : la relation
 * client y pèse lourd (centres d'appels), l'hôtellerie et le BTP aussi.
 *
 * `exempleTitre` et `exempleCompetences` alimentent les champs du formulaire :
 * un exemple pris dans le métier du recruteur vaut mieux qu'un champ vide.
 */
export const SECTEURS = [
  {
    cle: "informatique",
    libelle: "Informatique & tech",
    exempleTitre: "Développeur React",
    exempleCompetences: "React, TypeScript, Node.js",
  },
  {
    cle: "ingenierie",
    libelle: "Ingénierie & industrie",
    exempleTitre: "Ingénieur méthodes",
    exempleCompetences: "Lean, AutoCAD, amélioration continue",
  },
  {
    cle: "sante",
    libelle: "Santé & médical",
    exempleTitre: "Infirmier diplômé d'État",
    exempleCompetences: "Soins intensifs, urgences, pédiatrie",
  },
  {
    cle: "finance",
    libelle: "Finance, comptabilité & assurance",
    exempleTitre: "Comptable général",
    exempleCompetences: "Consolidation, IFRS, Sage",
  },
  {
    cle: "commerce",
    libelle: "Commerce & vente",
    exempleTitre: "Responsable de secteur",
    exempleCompetences: "Négociation, prospection, grands comptes",
  },
  {
    cle: "relation-client",
    libelle: "Relation client & centres d'appels",
    exempleTitre: "Téléconseiller francophone",
    exempleCompetences: "Service client, CRM, français courant",
  },
  {
    cle: "marketing",
    libelle: "Marketing & communication",
    exempleTitre: "Chef de produit",
    exempleCompetences: "Études de marché, SEO, réseaux sociaux",
  },
  {
    cle: "rh-juridique",
    libelle: "Ressources humaines & juridique",
    exempleTitre: "Chargé de recrutement",
    exempleCompetences: "Sourcing, droit du travail, paie",
  },
  {
    cle: "btp-immobilier",
    libelle: "BTP & immobilier",
    exempleTitre: "Conducteur de travaux",
    exempleCompetences: "Gros œuvre, suivi de chantier, sécurité",
  },
  {
    cle: "transport-logistique",
    libelle: "Transport & logistique",
    exempleTitre: "Responsable d'entrepôt",
    exempleCompetences: "WMS, gestion de stock, transport",
  },
  {
    cle: "hotellerie-restauration",
    libelle: "Hôtellerie & restauration",
    exempleTitre: "Chef de rang",
    exempleCompetences: "Service en salle, œnologie, anglais",
  },
  {
    cle: "education",
    libelle: "Éducation & formation",
    exempleTitre: "Formateur bureautique",
    exempleCompetences: "Ingénierie pédagogique, animation de groupe",
  },
  {
    cle: "autre",
    libelle: "Autre secteur",
    exempleTitre: "Intitulé du poste à pourvoir",
    exempleCompetences: "Compétences attendues, séparées par des virgules",
  },
] as const;

export type SecteurCle = (typeof SECTEURS)[number]["cle"];

const CLES_SECTEURS = SECTEURS.map((s) => s.cle) as [SecteurCle, ...SecteurCle[]];

/** Libellé lisible d'un secteur, ou undefined si le poste n'en précise aucun. */
export function libelleSecteur(cle?: string): string | undefined {
  return SECTEURS.find((s) => s.cle === cle)?.libelle;
}

export const JobCriteriaSchema = z.object({
  titre: z.string().min(1),
  competences: z.array(z.string()).default([]),
  /**
   * Facultatif : les postes créés avant l'ouverture aux autres secteurs n'en
   * ont pas, et un recruteur peut légitimement ne pas vouloir le préciser.
   */
  secteur: z.enum(CLES_SECTEURS).optional(),
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
