// Miroir de TEMPLATE_VARIABLES de @recruitai/types. Défini localement pour
// éviter d'importer une valeur runtime du package (extensions .js style
// NodeNext) dans un bundle client Next.js, qui échoue à les résoudre.
// Garder synchronisé avec packages/types/src/outreach.ts.
export const TEMPLATE_VARIABLES = ["prenom", "nom", "poste", "entreprise", "localisation"] as const;
