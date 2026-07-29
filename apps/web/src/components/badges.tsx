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
 * Signale un profil que l'IA n'a pas pu noter. Volontairement distinct du
 * badge de validation : c'est un incident technique, pas une décision du
 * recruteur — le candidat reste « à valider ».
 */
export function ScoringBadge({
  statutScoring,
  erreur,
}: {
  statutScoring?: string;
  erreur?: string | null;
}) {
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
