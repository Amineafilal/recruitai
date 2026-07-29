/**
 * Événement unifié de la timeline candidat.
 *
 * Les événements viennent de quatre sources hétérogènes (création du candidat,
 * mouvements de pipeline, notes, activités). On les normalise ici pour que
 * l'interface n'ait qu'une seule forme à afficher.
 */
export type TimelineType = "sourcing" | "etape" | "note" | "score" | "appel" | "email" | "autre";

export interface TimelineEvent {
  id: string;
  type: TimelineType;
  /** Phrase courte affichée en titre de l'événement. */
  resume: string;
  /** Contenu long éventuel (corps d'une note, compte rendu d'appel). */
  details: string | null;
  auteurEmail: string;
  auteurUserId: string | null;
  horodatage: string;
  /** Données propres au type, pour un rendu enrichi côté interface. */
  meta?: Record<string, unknown> | null;
  /**
   * Vrai si l'utilisateur peut supprimer l'événement. Seules les notes le
   * sont : l'historique des étapes et des scores est un journal, l'effacer
   * retirerait toute valeur de preuve à la timeline.
   */
  supprimable: boolean;
}
