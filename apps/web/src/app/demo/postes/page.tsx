import { CockpitShell, PageHeader } from "@/components/CockpitShell";
import { StatTile } from "@/components/StatTile";
import { JobCard } from "@/components/JobCard";
import { MOCK_JOBS } from "@/lib/mock";

export default function DemoPostesPage() {
  const ouverts = MOCK_JOBS.filter((j) => j.statut === "ouvert").length;
  const total = MOCK_JOBS.reduce((n, j) => n + (j.shortlistCount ?? 0), 0);

  return (
    <CockpitShell navBase="/demo" user={<DemoUser />}>
      <PageHeader eyebrow="Cockpit sourcing" title="Postes ouverts">
        <button className="rounded-xl bg-accent px-4 py-2 text-[14px] font-medium text-white transition-colors hover:bg-accent-ink">
          + Nouveau poste
        </button>
      </PageHeader>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Postes actifs" value={ouverts} accent="emerald" delay={0} hint="sur 4 postes" />
        <StatTile label="Candidats sourcés" value={total} accent="accent" delay={80} hint="toutes shortlists" />
        <StatTile label="Sources actives" value={4} accent="blue" delay={160} hint="LinkedIn, Indeed, Apec, WTTJ" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {MOCK_JOBS.map((job, i) => (
          <JobCard key={job.id} job={job} href={`/demo/postes/${job.id}`} index={i} />
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
