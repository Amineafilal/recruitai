"use client";

import { useState } from "react";
import Link from "next/link";
import { ScoreRing } from "./ScoreRing";
import { SourceBadge, ValidationBadge, ScoringBadge } from "./badges";
import {
  candidateName,
  candidateTitle,
  candidateLocation,
  dureeLisible,
  experiencesNormalisees,
  type SourcingCandidateView,
} from "@/lib/view-types";

export function CandidateCard({
  candidate,
  index = 0,
  onValidate,
  href,
}: {
  candidate: SourcingCandidateView;
  index?: number;
  onValidate?: (id: string, statut: "valide" | "rejete") => Promise<void>;
  /** Lien vers la fiche détaillée. Absent en démo, où la fiche n'existe pas. */
  href?: string;
}) {
  const [statut, setStatut] = useState(candidate.statutValidation);
  const [pending, setPending] = useState<null | "valide" | "rejete">(null);
  const p = candidate.profil;
  // Expérience la plus significative, après dédoublonnage : le tableau brut
  // peut contenir deux fois le même poste avec des durées différentes.
  const experiencePrincipale = experiencesNormalisees(p)[0];

  async function act(next: "valide" | "rejete") {
    setPending(next);
    try {
      await onValidate?.(candidate.id, next);
      setStatut(next);
    } finally {
      setPending(null);
    }
  }

  const decided = statut === "valide" || statut === "rejete";

  return (
    <div
      className="card animate-rise-in p-4 transition-shadow hover:shadow-card-hover"
      style={{ animationDelay: `${index * 45}ms`, opacity: statut === "rejete" ? 0.6 : 1 }}
    >
      <div className="flex items-center gap-4">
        <ScoreRing score={candidate.score} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {href ? (
              <Link href={href} className="truncate text-[15px] font-bold text-ink hover:text-accent hover:underline">
                {candidateName(p)}
              </Link>
            ) : (
              <h3 className="truncate text-[15px] font-bold text-ink">{candidateName(p)}</h3>
            )}
            <SourceBadge source={candidate.source} />
            <ValidationBadge statut={statut} />
            <ScoringBadge statutScoring={candidate.statutScoring} erreur={candidate.scoringErreur} />
          </div>
          {candidateTitle(p) && <p className="mt-0.5 truncate text-[13px] text-ink-soft">{candidateTitle(p)}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-ink-faint">
            {candidateLocation(p) && <span>{candidateLocation(p)}</span>}
            {experiencePrincipale?.dureeMois != null && (
              <span>· {dureeLisible(experiencePrincipale.dureeMois)} au poste</span>
            )}
            {p.linkedinUrl && (
              <a href={p.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                Profil ↗
              </a>
            )}
          </div>
        </div>

        {!decided && onValidate && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => act("rejete")}
              disabled={pending !== null}
              className="rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium text-ink-soft transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40"
            >
              {pending === "rejete" ? "…" : "Rejeter"}
            </button>
            <button
              onClick={() => act("valide")}
              disabled={pending !== null}
              className="rounded-lg bg-accent px-4 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-accent-ink disabled:opacity-40"
            >
              {pending === "valide" ? "…" : "Valider"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
