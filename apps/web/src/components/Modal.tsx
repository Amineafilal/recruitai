"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Boîte de dialogue commune aux formulaires et confirmations du cockpit.
 * Fermeture au clic extérieur et à Échap — sauf pendant une soumission, pour
 * éviter de fermer l'écran alors que la requête est encore en vol.
 *
 * Rendue dans un PORTAIL, à la racine du document, et non là où elle est
 * appelée. Raison mesurée : les cartes du cockpit portent l'animation
 * `rise-in`, qui laisse un `transform` sur l'élément une fois jouée. Or un
 * transform — même identité — crée un bloc conteneur pour les descendants
 * `position: fixed`. La modale se calait donc sur la carte appelante (110 px
 * de haut) au lieu de la fenêtre : voile assombri réduit à une bande, dialogue
 * coupé, boutons hors de l'écran. Le portail la sort de tout ancêtre transformé
 * et immunise durablement le composant.
 */
export function Modal({
  titre,
  description,
  children,
  onClose,
  bloque = false,
  largeur = "w-[480px]",
}: {
  titre: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  bloque?: boolean;
  largeur?: string;
}) {
  // Le portail n'existe qu'au navigateur : on ne rend rien au premier passage
  // serveur, sinon l'hydratation diverge.
  const [monte, setMonte] = useState(false);
  useEffect(() => setMonte(true), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !bloque) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [bloque, onClose]);

  // Le fond ne doit pas défiler sous la modale : la molette faisait glisser la
  // page derrière le voile, et l'on retrouvait un écran différent en fermant.
  useEffect(() => {
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = avant;
    };
  }, []);

  if (!monte) return null;

  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm"
      onClick={() => !bloque && onClose()}
    >
      {/* min-h-full + centrage en flex plutôt que place-items-center : quand la
          boîte dépasse la hauteur de la fenêtre, un centrage strict pousse son
          haut au-dessus de la zone défilable et le titre devient inatteignable.
          Ici elle se cale en haut et défile normalement. */}
      <div className="flex min-h-full items-center justify-center p-6">
        <div
          className={`card animate-rise-in ${largeur} max-w-[94vw] p-6`}
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="mb-1 font-display text-xl font-bold text-ink">{titre}</h2>
          {description && <p className="mb-5 text-[13px] text-ink-soft">{description}</p>}
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Confirmation avant une action irréversible. `danger` colore le bouton en
 * rouge : une suppression ne doit pas ressembler visuellement à un
 * enregistrement.
 */
export function ConfirmDialog({
  titre,
  description,
  libelleConfirmer,
  onConfirm,
  onClose,
  pending = false,
  erreur,
  danger = true,
}: {
  titre: string;
  description: string;
  libelleConfirmer: string;
  onConfirm: () => void;
  onClose: () => void;
  pending?: boolean;
  erreur?: string | null;
  danger?: boolean;
}) {
  return (
    <Modal titre={titre} description={description} onClose={onClose} bloque={pending} largeur="w-[420px]">
      {erreur && (
        <p className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-[13px] font-medium text-danger">{erreur}</p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="rounded-lg border border-line px-4 py-2 text-[14px] text-ink-soft hover:text-ink disabled:opacity-50"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className={`rounded-lg px-4 py-2 text-[14px] font-medium text-white disabled:opacity-50 ${
            danger ? "bg-danger hover:opacity-90" : "bg-accent hover:bg-accent-ink"
          }`}
        >
          {pending ? "En cours…" : libelleConfirmer}
        </button>
      </div>
    </Modal>
  );
}
