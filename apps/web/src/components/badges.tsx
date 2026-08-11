import type { ReactNode } from "react";

const SOURCE_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  indeed: "Indeed",
  apec: "Apec",
  wttj: "WTTJ",
};

export function SourceBadge({ source }: { source: string }) {
  return (
    <span className="rounded-md bg-paper-2 px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
      {SOURCE_LABELS[source] ?? source}
    </span>
  );
}

const VALIDATION: Record<string, { label: string; cls: string }> = {
  a_valider: { label: "À valider", cls: "bg-amber-soft text-amber" },
  valide: { label: "Validé", cls: "bg-emerald-soft text-emerald" },
  rejete: { label: "Rejeté", cls: "bg-paper-2 text-ink-faint" },
};

export function ValidationBadge({ statut }: { statut: string }) {
  const s = VALIDATION[statut] ?? VALIDATION.a_valider;
  return <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>;
}

/**
 * Signale un profil sans note, et dit LAQUELLE des deux raisons s'applique.
 *
 * « Scoring impossible » est un incident technique : réessayer peut aboutir.
 * « Profil trop incomplet » est définitif tant que la source ne renvoie pas
 * davantage — le recruteur doit savoir qu'il n'a pas à attendre une note.
 * Les confondre menait à afficher 0/100, c'est-à-dire à faire passer pour un
 * mauvais candidat quelqu'un qui n'avait simplement pas été évalué.
 *
 * Dans les deux cas, distinct du badge de validation : ce n'est pas une
 * décision du recruteur, le candidat reste « à valider ».
 */
export function ScoringBadge({
  statutScoring,
  erreur,
}: {
  statutScoring?: string;
  erreur?: string | null;
}) {
  if (statutScoring === "non_evaluable") {
    return (
      <span
        className="rounded-md bg-paper-2 px-2 py-0.5 text-[11px] font-semibold text-ink-faint"
        title={erreur ?? "La source n'a renvoyé aucune donnée exploitable pour ce profil."}
      >
        Profil trop incomplet
      </span>
    );
  }
  if (statutScoring !== "echec") return null;
  return (
    <span
      className="rounded-md bg-danger-soft px-2 py-0.5 text-[11px] font-semibold text-danger"
      title={erreur ?? "Le scoring n'a pas abouti"}
    >
      Scoring impossible
    </span>
  );
}

export function JobStatusBadge({ statut }: { statut: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    ouvert: { label: "Ouvert", cls: "bg-emerald-soft text-emerald" },
    en_pause: { label: "En pause", cls: "bg-amber-soft text-amber" },
    clos: { label: "Clos", cls: "bg-paper-2 text-ink-faint" },
  };
  const s = map[statut] ?? map.clos;
  return <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>;
}

export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md bg-paper-2 px-2 py-0.5 text-[11px] font-medium text-ink-soft">{children}</span>
  );
}
