import { CockpitShell, PageHeader } from "@/components/CockpitShell";
import { StatTile } from "@/components/StatTile";
import { Pill } from "@/components/badges";
import { MOCK_HOT_PROFILES } from "@/lib/mock";

const rel = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });
function ago(iso: string | null): string {
  if (!iso) return "jamais";
  const h = Math.round((Date.now() - new Date(iso).getTime()) / 3600e3);
  if (h < 1) return "à l'instant";
  if (h < 24) return rel.format(-h, "hour");
  return rel.format(-Math.round(h / 24), "day");
}

export default function DemoCvthequePage() {
  return (
    <CockpitShell navBase="/demo" user={<DemoUser />}>
      <PageHeader eyebrow="Réactivation intelligente" title="CVthèque">
        <button className="rounded-xl border border-line-strong bg-paper-2 px-4 py-2 text-[14px] font-medium text-ink transition-colors hover:bg-paper-2">
          ↑ Importer un CSV
        </button>
      </PageHeader>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Profils en base" value="48 210" accent="blue" delay={0} />
        <StatTile label="Profils chauds" value={MOCK_HOT_PROFILES.length} accent="accent" delay={80} hint="signaux détectés" />
        <StatTile label="Enrichis (24h)" value="1 340" accent="blue" delay={160} />
        <StatTile label="Relances envoyées" value="86" accent="emerald" delay={240} hint="ce mois" />
      </div>

      <div className="mb-3 flex items-center gap-2">
        <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
        <h2 className="font-display text-lg font-semibold">Candidats chauds</h2>
        <span className="text-[13px] text-ink-faint">— prêts à être relancés</span>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[14px]">
          <thead>
            <tr className="border-b border-line text-[12px] uppercase tracking-wider text-ink-faint">
              <th className="px-5 py-3 font-medium">Candidat</th>
              <th className="px-5 py-3 font-medium">Poste actuel</th>
              <th className="px-5 py-3 font-medium">Localisation</th>
              <th className="px-5 py-3 font-medium">Signal</th>
              <th className="px-5 py-3 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {MOCK_HOT_PROFILES.map((p, i) => (
              <tr
                key={p.id}
                className="animate-rise-in border-b border-line/60 last:border-0 hover:bg-paper-2"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-paper-2 font-mono text-[11px] text-ink-soft">
                      {(p.contact.prenom?.[0] ?? "") + (p.contact.nom?.[0] ?? "")}
                    </div>
                    <div>
                      <div className="font-medium text-ink">
                        {p.contact.prenom} {p.contact.nom}
                      </div>
                      <div className="text-[12px] text-ink-faint">{p.contact.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-ink-soft">
                  {p.contact.poste}
                  {p.contact.entreprise ? ` · ${p.contact.entreprise}` : ""}
                </td>
                <td className="px-5 py-3.5 text-ink-soft">{p.contact.localisation}</td>
                <td className="px-5 py-3.5">
                  <Pill>maj {ago(p.dernierEnrichissementAt)}</Pill>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <button className="rounded-lg bg-accent/15 px-3 py-1.5 text-[12px] font-medium text-accent transition-colors hover:bg-accent/25">
                    Relancer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CockpitShell>
  );
}

function DemoUser() {
  return (
    <>
      <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-blue to-blue text-[12px] font-bold text-white">
        AC
      </div>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-ink">Agence Convergence</p>
        <p className="truncate text-[11px] text-ink-faint">Plan Growth</p>
      </div>
    </>
  );
}
