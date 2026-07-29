import type { JobView, SourcingCandidateView, CvthequeProfileView } from "./view-types";

export const MOCK_JOBS: JobView[] = [
  {
    id: "j1",
    statut: "ouvert",
    createdAt: new Date().toISOString(),
    criteres: { titre: "Développeur React", competences: ["React", "TypeScript", "Next.js"], localisation: "Lyon", seniorite: "confirme" },
    shortlistCount: 14,
  },
  {
    id: "j2",
    statut: "ouvert",
    createdAt: new Date().toISOString(),
    criteres: { titre: "Data Analyst", competences: ["SQL", "Python", "Power BI"], localisation: "Paris", seniorite: "junior" },
    shortlistCount: 11,
  },
  {
    id: "j3",
    statut: "en_pause",
    createdAt: new Date().toISOString(),
    criteres: { titre: "Product Manager", competences: ["Roadmap", "Agile", "Analytics"], localisation: "Remote", seniorite: "senior" },
    shortlistCount: 8,
  },
  {
    id: "j4",
    statut: "ouvert",
    createdAt: new Date().toISOString(),
    criteres: { titre: "Ingénieur DevOps", competences: ["Kubernetes", "Terraform", "AWS"], localisation: "Bordeaux", seniorite: "confirme" },
    shortlistCount: 9,
  },
];

export const MOCK_SHORTLIST: SourcingCandidateView[] = [
  {
    id: "c1", source: "linkedin", score: 96, statutValidation: "a_valider",
    profil: { firstName: "David", lastName: "Urvoy", location: "Lyon, France", linkedinUrl: "#",
      currentPositions: [{ title: "Développeur React / Next.js", companyName: "Indépendant", tenureAtPosition: { numYears: 6 } }] },
  },
  {
    id: "c2", source: "linkedin", score: 92, statutValidation: "a_valider",
    profil: { firstName: "Cécile", lastName: "Nguyen", location: "Villeurbanne, France", linkedinUrl: "#",
      currentPositions: [{ title: "Frontend Engineer", companyName: "Ledger", tenureAtPosition: { numYears: 3 } }] },
  },
  {
    id: "c3", source: "wttj", score: 88, statutValidation: "valide",
    profil: { firstName: "Karim", lastName: "Benali", location: "Lyon, France", linkedinUrl: "#",
      currentPositions: [{ title: "Lead Front React", companyName: "Doctolib", tenureAtPosition: { numYears: 4 } }] },
  },
  {
    id: "c4", source: "linkedin", score: 79, statutValidation: "a_valider",
    profil: { firstName: "Sophie", lastName: "Marchand", location: "Saint-Étienne, France", linkedinUrl: "#",
      currentPositions: [{ title: "Développeuse Fullstack", companyName: "Freelance", tenureAtPosition: { numYears: 2 } }] },
  },
  {
    id: "c5", source: "indeed", score: 74, statutValidation: "a_valider",
    profil: { firstName: "Thomas", lastName: "Leroy", location: "Lyon, France", linkedinUrl: "#",
      currentPositions: [{ title: "Développeur Web JS", companyName: "Agence Kaliop", tenureAtPosition: { numYears: 5 } }] },
  },
  {
    id: "c6", source: "linkedin", score: 61, statutValidation: "rejete",
    profil: { firstName: "Julie", lastName: "Fabre", location: "Grenoble, France", linkedinUrl: "#",
      currentPositions: [{ title: "Intégratrice web", companyName: "Studio Meta", tenureAtPosition: { numYears: 2 } }] },
  },
];

export const MOCK_HOT_PROFILES: CvthequeProfileView[] = [
  { id: "p1", statutChaud: true, dernierEnrichissementAt: new Date().toISOString(),
    contact: { prenom: "Antoine", nom: "Rousseau", email: "a.rousseau@mail.fr", poste: "Développeur Java", entreprise: "Sopra", localisation: "Nantes" } },
  { id: "p2", statutChaud: true, dernierEnrichissementAt: new Date(Date.now() - 6 * 3600e3).toISOString(),
    contact: { prenom: "Léa", nom: "Moreau", email: "lea.moreau@mail.fr", poste: "UX Designer", entreprise: "Malt", localisation: "Paris" } },
  { id: "p3", statutChaud: true, dernierEnrichissementAt: new Date(Date.now() - 26 * 3600e3).toISOString(),
    contact: { prenom: "Hugo", nom: "Petit", email: "hugo.petit@mail.fr", poste: "Data Engineer", entreprise: "BlaBlaCar", localisation: "Lyon" } },
];
