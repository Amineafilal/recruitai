import { PageHeader } from "@/components/CockpitShell";
import { StatTile } from "@/components/StatTile";
import { JobCard } from "@/components/JobCard";
import { apiFetch } from "@/lib/api";
import type { JobView } from "@/lib/view-types";
import { NewJobButton } from "./NewJobButton";

export const dynamic = "force-dynamic";

export default async function PostesPage() {
  const jobs = await apiFetch<JobView[]>("/jobs");
  const ouverts = jobs.filter((j) => j.statut === "ouvert").length;

  return (
    <>
      <PageHeader eyebrow="Cockpit sourcing" title="Postes ouverts">
        <NewJobButton />
      </PageHeader>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Postes actifs" value={ouverts} accent="emerald" delay={0} hint={`sur ${jobs.length} postes`} />
        <StatTile label="Postes total" value={jobs.length} accent="accent" delay={80} />
        <StatTile label="Sources actives" value={1} accent="blue" delay={160} hint="LinkedIn" />
      </div>

      {jobs.length === 0 ? (
        <div className="card grid place-items-center px-6 py-16 text-center">
          <p className="font-display text-lg text-ink">Aucun poste pour l'instant</p>
          <p className="mt-1 text-[14px] text-ink-soft">
            Créez un poste : l'agent IA livrera une shortlist chaque matin.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {jobs.map((job, i) => (
            <JobCard key={job.id} job={job} href={`/postes/${job.id}`} index={i} />
          ))}
        </div>
      )}
    </>
  );
}
