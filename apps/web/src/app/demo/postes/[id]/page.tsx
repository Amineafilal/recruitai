import Link from "next/link";
import { CockpitShell, PageHeader } from "@/components/CockpitShell";
import { CandidateCard } from "@/components/CandidateCard";
import { Pill } from "@/components/badges";
import { MOCK_JOBS, MOCK_SHORTLIST } from "@/lib/mock";
import { villesJob } from "@/lib/view-types";

const dateFr = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

export default function DemoShortlistPage({ params }: { params: { id: string } }) {
  const job = MOCK_JOBS.find((j) => j.id === params.id) ?? MOCK_JOBS[0];
  // Les non-notés en fin de liste, comme côté serveur (`desc nulls last`).
  const candidats = [...MOCK_SHORTLIST].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  const aValider = candidats.filter((c) => c.statutValidation === "a_valider").length;

  return (
    <CockpitShell navBase="/demo" user={<DemoUser />}>
      <Link href="/demo/postes" className="mb-4 inline-block text-[13px] text-ink-soft hover:text-ink">
        ← Postes
      </Link>

      <PageHeader eyebrow={`Shortlist du ${dateFr.format(new Date())}`} title={job.criteres.titre}>
        <div className="text-right">
          <div className="font-display text-2xl font-bold text-accent">{candidats.length}</div>
          <div className="text-[12px] text-ink-faint">candidats · {aValider} à valider</div>
        </div>
      </PageHeader>

      {/* Bandeau critères + livraison. */}
      <div className="card mb-6 flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
        <div className="flex items-center gap-2">
          <span className="text-[12px] uppercase tracking-wider text-ink-faint">Localisation</span>
          <span className="text-[13px] text-ink">{villesJob(job.criteres).join(" · ") || "—"}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] uppercase tracking-wider text-ink-faint">Séniorité</span>
          <span className="text-[13px] text-ink">{job.criteres.seniorite ?? "—"}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] uppercase tracking-wider text-ink-faint">Compétences</span>
          <div className="flex flex-wrap gap-1.5">
            {job.criteres.competences.map((c) => (
              <Pill key={c}>{c}</Pill>
            ))}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 text-[12px] text-emerald">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald" />
          Livrée ce matin par l'agent IA
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {candidats.map((c, i) => (
          <CandidateCard key={c.id} candidate={c} index={i} />
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
