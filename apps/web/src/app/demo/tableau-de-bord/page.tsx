import { CockpitShell, PageHeader } from "@/components/CockpitShell";
import { StatTile } from "@/components/StatTile";
import { SourcingAreaChart, SourceBarChart } from "@/components/Charts";

function I({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {d.split("|").map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

const PAR_JOUR = ["05/07","06/07","07/07","08/07","09/07","10/07","11/07","12/07","13/07","14/07","15/07","16/07","17/07","18/07"]
  .map((jour, i) => ({ jour, n: [4,6,3,8,5,9,7,11,8,13,10,14,12,15][i] }));
const PAR_SOURCE = [
  { source: "linkedin", n: 128 },
  { source: "indeed", n: 64 },
  { source: "apec", n: 41 },
  { source: "wttj", n: 23 },
];
const RECENTS = [
  { id: "1", nom: "Cyril Cessou", titre: "Senior React / React Native Developer", score: 95, source: "linkedin", statut: "valide" },
  { id: "2", nom: "Gaëtan Busato", titre: "Développeur Fullstack Next / Node / TS", score: 92, source: "linkedin", statut: "a_valider" },
  { id: "3", nom: "Mehdi Chekkouch", titre: "AI Automation Engineer", score: 88, source: "wttj", statut: "a_valider" },
  { id: "4", nom: "Sophie Marchand", titre: "Développeuse Fullstack", score: 74, source: "indeed", statut: "a_valider" },
  { id: "5", nom: "Julie Fabre", titre: "Intégratrice web", score: 58, source: "linkedin", statut: "rejete" },
];
const STATUT: Record<string, { label: string; cls: string }> = {
  a_valider: { label: "À valider", cls: "bg-amber-soft text-amber" },
  valide: { label: "Validé", cls: "bg-emerald-soft text-emerald" },
  rejete: { label: "Rejeté", cls: "bg-paper-2 text-ink-faint" },
};

export default function DemoDashboard() {
  return (
    <CockpitShell navBase="/demo" user={<DemoUser />}>
      <PageHeader eyebrow="Vue d'ensemble" title="Tableau de bord" subtitle="L'activité de sourcing et de réactivation de votre agence." />

      <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Postes actifs" value={7} accent="accent" change="+2" hint="cette semaine" icon={<I d="M3 7h18v13H3z|M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />} delay={0} />
        <StatTile label="Candidats sourcés" value="256" accent="violet" change="+18,4 %" hint="ce mois" icon={<I d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2|M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />} delay={60} />
        <StatTile label="Profils CVthèque" value="48 210" accent="emerald" change="+1 340" hint="enrichis (24h)" icon={<I d="M12 2 3 7l9 5 9-5-9-5z|M3 12l9 5 9-5|M3 17l9 5 9-5" />} delay={120} />
        <StatTile label="Taux de validation" value="34 %" accent="amber" change="+4,3 %" hint="score moyen 82/100" icon={<I d="M22 11.08V12a10 10 0 1 1-5.93-9.14|m9 11 3 3L22 4" />} delay={180} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-ink">Candidats sourcés</h3>
            <span className="text-[12px] text-ink-faint">14 derniers jours</span>
          </div>
          <SourcingAreaChart data={PAR_JOUR} />
        </div>
        <div className="card p-5">
          <h3 className="mb-2 text-[15px] font-bold text-ink">Par source</h3>
          <SourceBarChart data={PAR_SOURCE} />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-[15px] font-bold text-ink">Candidats récents</h3>
          <span className="text-[13px] font-medium text-accent">Voir les postes →</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[14px]">
          <thead>
            <tr className="border-b border-line text-[12px] font-semibold uppercase tracking-wide text-ink-faint">
              <th className="px-5 py-3">Candidat</th>
              <th className="px-5 py-3">Poste actuel</th>
              <th className="px-5 py-3">Source</th>
              <th className="px-5 py-3">Score</th>
              <th className="px-5 py-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            {RECENTS.map((c, i) => {
              const st = STATUT[c.statut];
              return (
                <tr key={c.id} className="animate-rise-in border-b border-line last:border-0 hover:bg-paper-2" style={{ animationDelay: `${i * 40}ms` }}>
                  <td className="px-5 py-3.5 font-semibold text-ink">{c.nom}</td>
                  <td className="max-w-[280px] truncate px-5 py-3.5 text-ink-soft">{c.titre}</td>
                  <td className="px-5 py-3.5 capitalize text-ink-soft">{c.source}</td>
                  <td className="px-5 py-3.5"><span className="font-mono font-bold text-ink">{c.score}</span><span className="text-ink-faint">/100</span></td>
                  <td className="px-5 py-3.5"><span className={`rounded-md px-2 py-0.5 text-[12px] font-semibold ${st.cls}`}>{st.label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
          </div>
      </div>
    </CockpitShell>
  );
}

function DemoUser() {
  return (
    <>
      <div className="grid h-9 w-9 place-items-center rounded-full bg-accent text-[13px] font-bold text-white">AC</div>
      <div className="hidden sm:block">
        <p className="text-[13px] font-semibold text-ink">Agence Convergence</p>
        <p className="text-[11px] text-ink-faint">Plan Growth</p>
      </div>
    </>
  );
}
