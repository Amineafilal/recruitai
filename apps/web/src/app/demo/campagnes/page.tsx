import { CockpitShell, PageHeader } from "@/components/CockpitShell";
import { StatTile } from "@/components/StatTile";
import { DemoNewCampaign } from "./DemoNewCampaign";

const MOCK_CAMPAGNES = [
  { id: "1", nom: "Réactivation dev fullstack", declencheur: "changement_poste", statut: "actif", envoyes: 42 },
  { id: "2", nom: "Relance data / BI", declencheur: "nouveau_diplome", statut: "actif", envoyes: 28 },
  { id: "3", nom: "Talents produit", declencheur: "manuel", statut: "pause", envoyes: 16 },
];

export default function DemoCampagnesPage() {
  return (
    <CockpitShell navBase="/demo" user={<DemoUser />}>
      <PageHeader eyebrow="Relances automatisées" title="Campagnes">
        <DemoNewCampaign />
      </PageHeader>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Campagnes actives" value={2} accent="emerald" delay={0} />
        <StatTile label="Relances (mois)" value={86} accent="accent" delay={80} />
        <StatTile label="Taux de réponse" value="12 %" accent="blue" delay={160} hint="moyenne" />
      </div>

      <div className="flex flex-col gap-3">
        {MOCK_CAMPAGNES.map((c, i) => (
          <div
            key={c.id}
            className="card animate-rise-in flex items-center justify-between p-4"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-[15px] font-semibold">{c.nom}</h3>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] ${
                    c.statut === "actif"
                      ? "border-emerald/25 bg-emerald/10 text-emerald"
                      : "border-amber/25 bg-amber/10 text-amber"
                  }`}
                >
                  {c.statut === "actif" ? "Actif" : "En pause"}
                </span>
              </div>
              <p className="mt-0.5 font-mono text-[12px] text-ink-faint">déclencheur : {c.declencheur}</p>
            </div>
            <div className="text-right">
              <div className="font-mono text-lg font-bold text-ink">{c.envoyes}</div>
              <div className="text-[12px] text-ink-faint">relances envoyées</div>
            </div>
          </div>
        ))}
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
