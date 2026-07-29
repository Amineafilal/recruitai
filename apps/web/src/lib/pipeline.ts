/**
 * Étapes du pipeline côté interface.
 *
 * Duplique volontairement la liste de @recruitai/types : les composants client
 * ne doivent pas tirer un paquet serveur dans le bundle du navigateur. Toute
 * modification ici doit être répercutée dans packages/types/src/candidate.ts.
 */
export const ETAPES = [
  "source",
  "a_valider",
  "retenu",
  "entretien_planifie",
  "entretien_realise",
  "offre_envoyee",
  "embauche",
  "rejete",
] as const;

export type Etape = (typeof ETAPES)[number];

export const ETAPE_LABELS: Record<Etape, string> = {
  source: "Sourcé",
  a_valider: "À valider",
  retenu: "Retenu",
  entretien_planifie: "Entretien planifié",
  entretien_realise: "Entretien réalisé",
  offre_envoyee: "Offre envoyée",
  embauche: "Embauché",
  rejete: "Rejeté",
};

/** Courte explication affichée en info-bulle sur l'en-tête de colonne. */
export const ETAPE_AIDE: Record<Etape, string> = {
  source: "L'agent IA l'a trouvé, personne ne l'a encore regardé",
  a_valider: "Mis de côté par un recruteur, en attente de décision",
  retenu: "Approuvé, prêt à être contacté",
  entretien_planifie: "Un rendez-vous est fixé",
  entretien_realise: "L'entretien a eu lieu",
  offre_envoyee: "Une proposition lui a été transmise",
  embauche: "Placement réussi",
  rejete: "Écarté du processus",
};

/**
 * Couleur d'accent par colonne. Le vert et le rouge sont réservés aux deux
 * issues finales pour qu'on repère l'état d'un pipeline d'un coup d'œil.
 */
export const ETAPE_COULEURS: Record<Etape, { barre: string; texte: string; fond: string }> = {
  source: { barre: "bg-ink-faint", texte: "text-ink-soft", fond: "bg-paper-2" },
  a_valider: { barre: "bg-amber", texte: "text-amber", fond: "bg-amber-soft" },
  retenu: { barre: "bg-accent", texte: "text-accent", fond: "bg-accent-soft" },
  entretien_planifie: { barre: "bg-blue", texte: "text-blue", fond: "bg-blue/10" },
  entretien_realise: { barre: "bg-blue", texte: "text-blue", fond: "bg-blue/10" },
  offre_envoyee: { barre: "bg-violet", texte: "text-violet", fond: "bg-violet/10" },
  embauche: { barre: "bg-emerald", texte: "text-emerald", fond: "bg-emerald-soft" },
  rejete: { barre: "bg-danger", texte: "text-danger", fond: "bg-danger-soft" },
};

export function estEtape(v: unknown): v is Etape {
  return typeof v === "string" && (ETAPES as readonly string[]).includes(v);
}
