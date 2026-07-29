import type { ReactNode } from "react";

const TONES: Record<string, { badge: string; icon: string }> = {
  ink: { badge: "bg-paper-2 text-ink-soft", icon: "text-ink-soft" },
  accent: { badge: "bg-accent-soft text-accent", icon: "text-accent" },
  blue: { badge: "bg-accent-soft text-accent", icon: "text-accent" },
  emerald: { badge: "bg-emerald-soft text-emerald", icon: "text-emerald" },
  violet: { badge: "bg-violet-soft text-violet", icon: "text-violet" },
  amber: { badge: "bg-amber-soft text-amber", icon: "text-amber" },
};

export function StatTile({
  label,
  value,
  hint,
  accent = "accent",
  icon,
  change,
  delay = 0,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: "ink" | "accent" | "blue" | "emerald" | "violet" | "amber";
  icon?: ReactNode;
  /** ex. "+12,5 %" (positif vert / négatif rouge selon le signe). */
  change?: string;
  delay?: number;
}) {
  const tone = TONES[accent] ?? TONES.accent;
  const positive = change ? !change.trim().startsWith("-") : true;

  return (
    <div className="card animate-rise-in p-5 transition-shadow hover:shadow-card-hover" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start justify-between">
        <span className="text-[13px] font-medium text-ink-soft">{label}</span>
        {icon && <span className={`grid h-9 w-9 place-items-center rounded-lg ${tone.badge}`}>{icon}</span>}
      </div>
      <div className="mt-3 text-[30px] font-extrabold tracking-tight tabular-nums text-ink">{value}</div>
      <div className="mt-1 flex items-center gap-2">
        {change && (
          <span
            className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[12px] font-semibold ${
              positive ? "bg-emerald-soft text-emerald" : "bg-danger-soft text-danger"
            }`}
          >
            {positive ? "▲" : "▼"} {change.replace(/^[+-]/, "")}
          </span>
        )}
        {hint && <span className="text-[12.5px] text-ink-faint">{hint}</span>}
      </div>
    </div>
  );
}
