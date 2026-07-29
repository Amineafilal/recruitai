"use client";

import { useTransition } from "react";
import { supprimerDemo } from "./actions";

/**
 * Bandeau affiché tant que des fiches de démonstration sont présentes.
 *
 * Il doit être impossible de confondre ces profils fictifs avec de vrais
 * candidats : sans repère permanent à l'écran, une agence pourrait croire que
 * sa CVthèque contient de vraies données.
 */
export function DemoBanner({ nombre }: { nombre: number }) {
  const [pending, start] = useTransition();

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber/40 bg-amber/10 px-4 py-3">
      <p className="text-[13px] text-ink-soft">
        <span className="font-semibold text-ink">Mode démonstration —</span> {nombre} profil
        {nombre > 1 ? "s" : ""} fictif{nombre > 1 ? "s" : ""} dans cette liste. Aucun email ne leur sera
        jamais envoyé.
      </p>
      <button
        onClick={() => start(() => supprimerDemo().then(() => undefined))}
        disabled={pending}
        className="shrink-0 rounded-lg border border-line bg-card px-3 py-1.5 text-[13px] font-semibold text-ink-soft transition-colors hover:text-ink disabled:opacity-50"
      >
        {pending ? "Suppression…" : "Retirer la démo"}
      </button>
    </div>
  );
}
