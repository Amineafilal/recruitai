import { PageHeader } from "@/components/CockpitShell";
import { StatTile } from "@/components/StatTile";
import { Pill } from "@/components/badges";
import { apiFetch } from "@/lib/api";
import type { CvthequeProfileView } from "@/lib/view-types";
import { getSessionUser } from "@/lib/session";
import { ImportButton } from "./ImportButton";
import { EmptyState } from "./EmptyState";
import { DemoBanner } from "./DemoBanner";

export const dynamic = "force-dynamic";

interface CvStats {
  total: number;
  chauds: number;
  avecEmail: number;
  /** Nombre de fiches de démonstration présentes. */
  demo: number;
}

const rel = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });
function ago(iso: string | null): string {
  if (!iso) return "—";
  const h = Math.round((Date.now() - new Date(iso).getTime()) / 3600e3);
  if (h < 1) return "à l'instant";
  if (h < 24) return rel.format(-h, "hour");
  return rel.format(-Math.round(h / 24), "day");
}

export default async function CvthequePage() {
  const [profils, stats, session] = await Promise.all([
    apiFetch<CvthequeProfileView[]>("/cvtheque/profils"),
    apiFetch<CvStats>("/cvtheque/stats"),
    getSessionUser(),
  ]);
  const estAdmin = session?.role === "admin";

  return (
    <>
      <PageHeader eyebrow="Réactivation intelligente" title="CVthèque">
        <ImportButton />
      </PageHeader>

      {stats.demo > 0 && <DemoBanner nombre={stats.demo} />}

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Profils en base" value={stats.total.toLocaleString("fr-FR")} accent="blue" delay={0} />
        <StatTile label="Profils chauds" value={stats.chauds} accent="accent" delay={80} hint="signaux détectés" />
        <StatTile label="Relançables" value={stats.avecEmail} accent="emerald" delay={160} hint="avec email" />
      </div>

      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-display text-lg font-semibold">Profils</h2>
        <span className="text-[13px] text-ink-faint">— {stats.total} au total</span>
      </div>

      {profils.length === 0 ? (
        <EmptyState estAdmin={estAdmin} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[14px]">
            <thead>
              <tr className="border-b border-line text-[12px] uppercase tracking-wider text-ink-faint">
                <th className="px-5 py-3 font-medium">Candidat</th>
                <th className="px-5 py-3 font-medium">Poste</th>
                <th className="px-5 py-3 font-medium">Localisation</th>
                <th className="px-5 py-3 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {profils.map((p, i) => (
                <tr
                  key={p.id}
                  className="animate-rise-in border-b border-line/60 last:border-0 hover:bg-paper-2"
                  style={{ animationDelay: `${Math.min(i, 15) * 40}ms` }}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="grid h-8 w-8 place-items-center rounded-full bg-paper-2 font-mono text-[11px] text-ink-soft">
                        {((p.contact.prenom?.[0] ?? "") + (p.contact.nom?.[0] ?? "")) || "?"}
                      </div>
                      <div>
                        <div className="font-medium text-ink">
                          {[p.contact.prenom, p.contact.nom].filter(Boolean).join(" ") || "Candidat"}
                        </div>
                        <div className="text-[12px] text-ink-faint">{p.contact.email ?? "—"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-ink-soft">
                    {p.contact.poste ?? "—"}
                    {p.contact.entreprise ? ` · ${p.contact.entreprise}` : ""}
                  </td>
                  <td className="px-5 py-3.5 text-ink-soft">{p.contact.localisation ?? "—"}</td>
                  <td className="px-5 py-3.5">
                    {p.statutChaud ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                        Chaud · maj {ago(p.dernierEnrichissementAt)}
                      </span>
                    ) : (
                      <Pill>importé</Pill>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
