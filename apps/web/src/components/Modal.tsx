"use client";

import { useEffect, type ReactNode } from "react";

/**
 * Boîte de dialogue commune aux formulaires et confirmations du cockpit.
 * Fermeture au clic extérieur et à Échap — sauf pendant une soumission, pour
 * éviter de fermer l'écran alors que la requête est encore en vol.
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
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !bloque) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [bloque, onClose]);

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-6 backdrop-blur-sm"
      onClick={() => !bloque && onClose()}
    >
      <div
        className={`card animate-rise-in my-auto ${largeur} max-w-[94vw] p-6`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 font-display text-xl font-bold text-ink">{titre}</h2>
        {description && <p className="mb-5 text-[13px] text-ink-soft">{description}</p>}
        {children}
      </div>
    </div>
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
