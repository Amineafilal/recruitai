"use client";

import { useState, useTransition } from "react";
import { definirValidation } from "./actions";

type Statut = "valide" | "rejete" | "a_valider";

export function ValidationActions({
  candidateId,
  jobId,
  statutInitial,
}: {
  candidateId: string;
  jobId: string;
  statutInitial: string;
}) {
  const [statut, setStatut] = useState<string>(statutInitial);
  const [pending, start] = useTransition();

  function definir(next: Statut) {
    start(async () => {
      await definirValidation(candidateId, jobId, next);
      setStatut(next);
    });
  }

  if (statut === "a_valider") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[13px] text-ink-soft">Ce candidat correspond-il au poste ?</span>
        <button
          onClick={() => definir("rejete")}
          disabled={pending}
          className="rounded-lg border border-line px-4 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:text-ink disabled:opacity-40"
        >
          Rejeter
        </button>
        <button
          onClick={() => definir("valide")}
          disabled={pending}
          className="rounded-lg bg-accent px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-accent-ink disabled:opacity-40"
        >
          Valider
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-[13px] text-ink-soft">
        {statut === "valide" ? "Candidat validé pour ce poste." : "Candidat écarté de cette shortlist."}
      </span>
      <button
        onClick={() => definir("a_valider")}
        disabled={pending}
        className="text-[13px] font-medium text-accent hover:underline disabled:opacity-40"
      >
        Revenir sur cette décision
      </button>
    </div>
  );
}
