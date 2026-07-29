import { PageHeader } from "@/components/CockpitShell";
import { StatTile } from "@/components/StatTile";
import { apiFetch } from "@/lib/api";
import { NewCampaignButton } from "./NewCampaignButton";
import { CampaignToggle } from "./CampaignRow";
import { CampaignActions } from "./CampaignActions";

export const dynamic = "force-dynamic";

interface CampaignView {
  id: string;
  nom: string;
  sujet: string;
  template: string;
  declencheur: string;
  delaiMinRelanceJours: number;
  statut: string;
}

export default async function CampagnesPage() {
  const campagnes = await apiFetch<CampaignView[]>("/campagnes");
  const actives = campagnes.filter((c) => c.statut === "actif").length;

  return (
    <>
      <PageHeader eyebrow="Relances automatisées" title="Campagnes">
        <NewCampaignButton />
      </PageHeader>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Campagnes actives" value={actives} accent="emerald" delay={0} />
        <StatTile label="Campagnes total" value={campagnes.length} accent="accent" delay={80} />
        <StatTile label="Envois" value="—" accent="blue" delay={160} hint="voir historique" />
      </div>

      {campagnes.length === 0 ? (
        <div className="card grid place-items-center px-6 py-16 text-center">
          <p className="font-display text-lg text-ink">Aucune campagne</p>
          <p className="mt-1 text-[14px] text-ink-soft">
            Créez une campagne pour relancer automatiquement vos candidats chauds.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {campagnes.map((c, i) => (
            <div
              key={c.id}
              className="card animate-rise-in flex items-center justify-between p-4"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-display text-[15px] font-semibold">{c.nom}</h3>
                  <CampaignToggle id={c.id} statut={c.statut} />
                </div>
                <p className="mt-0.5 font-mono text-[12px] text-ink-faint">déclencheur : {c.declencheur}</p>
              </div>
              <CampaignActions campagne={c} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
