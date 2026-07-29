"use client";

import { useState, type ReactNode } from "react";

/**
 * Bascule Liste / Pipeline.
 *
 * Les deux vues sont rendues côté serveur puis affichées/masquées ici : cela
 * évite un aller-retour réseau au changement de vue, au prix d'un peu de HTML
 * supplémentaire — négligeable pour une shortlist.
 */
export function VueToggle({ liste, pipeline }: { liste: ReactNode; pipeline: ReactNode }) {
  const [vue, setVue] = useState<"pipeline" | "liste">("pipeline");

  return (
    <>
      <div className="mb-4 flex items-center gap-1 rounded-lg border border-line bg-card p-1 sm:w-fit">
        <Onglet actif={vue === "pipeline"} onClick={() => setVue("pipeline")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="5" height="16" rx="1" />
            <rect x="10" y="4" width="5" height="11" rx="1" />
            <rect x="17" y="4" width="4" height="7" rx="1" />
          </svg>
          Pipeline
        </Onglet>
        <Onglet actif={vue === "liste"} onClick={() => setVue("liste")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
          Liste
        </Onglet>
      </div>

      <div className={vue === "pipeline" ? "" : "hidden"}>{pipeline}</div>
      <div className={vue === "liste" ? "" : "hidden"}>{liste}</div>
    </>
  );
}

function Onglet({
  actif,
  onClick,
  children,
}: {
  actif: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors sm:flex-none ${
        actif ? "bg-accent text-white" : "text-ink-soft hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
