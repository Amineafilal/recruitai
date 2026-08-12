import { PageHeader } from "@/components/CockpitShell";
import { StatTile } from "@/components/StatTile";
import { apiFetch } from "@/lib/api";
import { NewCampaignButton } from "./NewCampaignButton";
import { CampaignCard, type CampaignVue } from "./CampaignCard";

export const dynamic = "force-dynamic";

export default async function CampagnesPage() {
  const campagnes = await apiFetch<CampaignVue[]>("/campagnes");
  const actives = campagnes.filter((c) => c.statut === "actif").length;
  const envois = campagnes.reduce((n, c) => n + (c.envoyes ?? 0), 0);
  const echecs = campagnes.reduce((n, c) => n + (c.echecs ?? 0), 0);

  return (
    <>
      <PageHeader eyebrow="Relances automatisées" title="Campagnes">
        <NewCampaignButton nombreExistant={campagnes.length} />
      </PageHeader>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Campagnes actives" value={actives} accent="emerald" delay={0} />
        <StatTile label="Campagnes total" value={campagnes.length} accent="accent" delay={80} />
        {/* Ce chiffre valait « — » quelle que soit la réalité : quatre messages
            avaient été traités sans que rien ne l'indique à l'écran. */}
        <StatTile
          label="Emails envoyés"
          value={envois}
          accent="blue"
          delay={160}
          hint={echecs > 0 ? `${echecs} envoi(s) en échec` : undefined}
        />
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
            <CampaignCard key={c.id} campagne={c} index={i} />
          ))}
        </div>
      )}
    </>
  );
}
