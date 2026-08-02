import Link from "next/link";
import { PageHeader } from "@/components/CockpitShell";
import { CandidateCard } from "@/components/CandidateCard";
import { Pill } from "@/components/badges";
import { apiFetch } from "@/lib/api";
import { villesJob, type JobView, type SourcingCandidateView } from "@/lib/view-types";
import { setValidation } from "../actions";
import { JobActions } from "./JobActions";
import { PipelineBoard } from "./PipelineBoard";
import { VueToggle } from "./VueToggle";
import { EtatSourcing } from "@/components/EtatSourcing";

export const dynamic = "force-dynamic";

const dateFr = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

export default async function ShortlistPage({ params }: { params: { id: string } }) {
  const [job, candidats] = await Promise.all([
    apiFetch<JobView>(`/jobs/${params.id}`),
    apiFetch<SourcingCandidateView[]>(`/jobs/${params.id}/shortlist`),
  ]);

  // Candidats encore actifs : ni embauchés ni rejetés.
  const enCours = candidats.filter((c) => c.etape !== "embauche" && c.etape !== "rejete").length;
  const villes = villesJob(job.criteres);

  // Server action liée au poste courant, passée aux cartes (composants client).
  async function onValidate(id: string, statut: "valide" | "rejete") {
    "use server";
    await setValidation(id, statut, params.id);
  }

  return (
    <>
      <Link href="/postes" className="mb-4 inline-block text-[13px] text-ink-soft hover:text-ink">
        ← Postes
      </Link>

      <PageHeader eyebrow={`Shortlist du ${dateFr.format(new Date())}`} title={job.criteres.titre}>
        <div className="text-right">
          <div className="font-display text-2xl font-bold text-accent">{candidats.length}</div>
          <div className="text-[12px] text-ink-faint">candidats · {enCours} en cours</div>
        </div>
      </PageHeader>

      <div className="mb-4">
        <JobActions job={job} />
      </div>

      <div className="card mb-6 flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] uppercase tracking-wider text-ink-faint">
            {villes.length > 1 ? "Villes" : "Localisation"}
          </span>
          {villes.length === 0 ? (
            <span className="text-[13px] text-ink">—</span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {villes.map((v) => (
                <Pill key={v}>{v}</Pill>
              ))}
            </div>
          )}
        </div>
        <Meta label="Séniorité" value={job.criteres.seniorite ?? "—"} />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] uppercase tracking-wider text-ink-faint">Compétences</span>
          <div className="flex flex-wrap gap-1.5">
            {job.criteres.competences.map((c) => (
              <Pill key={c}>{c}</Pill>
            ))}
          </div>
        </div>
      </div>

      {candidats.length === 0 ? (
        <EtatSourcing
          statut={job.sourcingStatut}
          message={job.sourcingMessage}
          quand={job.sourcingAt}
        />
      ) : (
        <VueToggle
          pipeline={<PipelineBoard candidats={candidats} jobId={params.id} />}
          liste={
            <div className="flex flex-col gap-3">
              {candidats.map((c, i) => (
                <CandidateCard
                  key={c.id}
                  candidate={c}
                  index={i}
                  onValidate={onValidate}
                  href={`/postes/${params.id}/candidats/${c.id}`}
                />
              ))}
            </div>
          }
        />
      )}
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] uppercase tracking-wider text-ink-faint">{label}</span>
      <span className="text-[13px] text-ink">{value}</span>
    </div>
  );
}
