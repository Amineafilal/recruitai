"use client";

import { useState, useTransition } from "react";
import { loggerAppel } from "./actions";

export type TimelineType = "sourcing" | "etape" | "note" | "score" | "appel" | "email" | "autre";

export interface TimelineEventView {
  id: string;
  type: TimelineType;
  resume: string;
  details: string | null;
  auteurEmail: string;
  auteurUserId: string | null;
  horodatage: string;
  meta?: Record<string, unknown> | null;
  supprimable: boolean;
}

const dateHeureFr = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Apparence par type d'événement : la couleur seule doit suffire à situer. */
const APPARENCE: Record<TimelineType, { couleur: string; fond: string; icone: JSX.Element }> = {
  sourcing: {
    couleur: "text-violet",
    fond: "bg-violet/10",
    icone: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </svg>
    ),
  },
  etape: {
    couleur: "text-accent",
    fond: "bg-accent-soft",
    icone: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  note: {
    couleur: "text-ink-soft",
    fond: "bg-paper-2",
    icone: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 5h16M4 10h16M4 15h10" strokeLinecap="round" />
      </svg>
    ),
  },
  score: {
    couleur: "text-emerald",
    fond: "bg-emerald-soft",
    icone: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 17l6-6 4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  appel: {
    couleur: "text-blue",
    fond: "bg-blue/10",
    icone: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
      </svg>
    ),
  },
  email: {
    couleur: "text-amber",
    fond: "bg-amber-soft",
    icone: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m2 7 10 6 10-6" />
      </svg>
    ),
  },
  autre: {
    couleur: "text-ink-faint",
    fond: "bg-paper-2",
    icone: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
  },
};

/**
 * Historique chronologique du candidat.
 *
 * Rassemble en une seule lecture ce qui était jusqu'ici éparpillé : le
 * sourcing, les mouvements de pipeline, les notes, les scores recalculés et
 * les appels. Un recruteur qui reprend un dossier voit tout de suite où il en
 * est sans reconstituer l'histoire de mémoire.
 */
export function Timeline({
  evenements,
  candidateId,
  jobId,
}: {
  evenements: TimelineEventView[];
  candidateId: string;
  jobId: string;
}) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-ink-faint">
          Historique
          <span className="ml-1.5 font-normal normal-case tracking-normal">
            ({evenements.length} événement{evenements.length > 1 ? "s" : ""})
          </span>
        </h2>
        <FormulaireAppel candidateId={candidateId} jobId={jobId} />
      </div>

      <ol className="flex flex-col">
        {evenements.map((e, i) => (
          <Evenement key={e.id} evenement={e} dernier={i === evenements.length - 1} />
        ))}
      </ol>
    </section>
  );
}

function Evenement({ evenement, dernier }: { evenement: TimelineEventView; dernier: boolean }) {
  const a = APPARENCE[evenement.type] ?? APPARENCE.autre;

  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {/* Filet vertical reliant les pastilles, sauf sous la dernière. */}
      {!dernier && <span className="absolute left-[13px] top-7 h-[calc(100%-1rem)] w-px bg-line" />}

      <span className={`relative z-10 mt-0.5 grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full ${a.fond} ${a.couleur}`}>
        {a.icone}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-ink">{evenement.resume}</p>
        {evenement.details && (
          <p className="mt-1 whitespace-pre-line rounded-lg bg-paper-2 px-3 py-2 text-[13px] leading-relaxed text-ink-soft">
            {evenement.details}
          </p>
        )}
        <p className="mt-1 text-[12px] text-ink-faint">
          {evenement.auteurEmail} · {dateHeureFr.format(new Date(evenement.horodatage))}
        </p>
      </div>
    </li>
  );
}

/** Consignation d'un appel : le seul événement que le recruteur crée à la main. */
function FormulaireAppel({ candidateId, jobId }: { candidateId: string; jobId: string }) {
  const [ouvert, setOuvert] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function envoyer(fd: FormData) {
    start(async () => {
      const res = await loggerAppel(candidateId, jobId, String(fd.get("resume") ?? ""), String(fd.get("details") ?? ""));
      if (res?.error) setErreur(res.error);
      else {
        setErreur(null);
        setOuvert(false);
      }
    });
  }

  if (!ouvert) {
    return (
      <button
        onClick={() => setOuvert(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[13px] font-semibold text-ink-soft transition-colors hover:border-blue/40 hover:text-blue"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
        </svg>
        Consigner un appel
      </button>
    );
  }

  return (
    <form action={envoyer} className="w-full rounded-xl border border-line bg-paper p-3">
      <input
        name="resume"
        required
        maxLength={200}
        placeholder="Issue de l'appel — ex. « Répondu, intéressé »"
        className="w-full rounded-lg border border-line bg-card px-3 py-2 text-[13px] text-ink outline-none placeholder:text-ink-faint focus:border-accent"
      />
      <textarea
        name="details"
        rows={3}
        placeholder="Compte rendu (facultatif)"
        className="mt-2 w-full resize-y rounded-lg border border-line bg-card px-3 py-2 text-[13px] leading-relaxed text-ink outline-none placeholder:text-ink-faint focus:border-accent"
      />
      {erreur && <p className="mt-2 text-[12px] font-medium text-danger">{erreur}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOuvert(false)}
          disabled={pending}
          className="rounded-lg px-3 py-1.5 text-[13px] text-ink-soft hover:text-ink"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-accent-ink disabled:opacity-50"
        >
          {pending ? "Enregistrement…" : "Consigner"}
        </button>
      </div>
    </form>
  );
}
