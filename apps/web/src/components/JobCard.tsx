import Link from "next/link";
import { JobStatusBadge, Pill } from "./badges";
import { villesJob, type JobView } from "@/lib/view-types";

export function JobCard({ job, href, index = 0 }: { job: JobView; href: string; index?: number }) {
  const villes = villesJob(job.criteres);
  return (
    <Link
      href={href}
      className="card group block animate-rise-in p-5 transition-shadow hover:shadow-card-hover"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[16px] font-bold text-ink group-hover:text-accent">{job.criteres.titre}</h3>
          <p className="mt-0.5 text-[13px] text-ink-soft">
            {/* Au-delà de deux villes on résume : sinon la carte déborde. */}
            {villes.length === 0
              ? "—"
              : villes.length <= 2
                ? villes.join(" · ")
                : `${villes.slice(0, 2).join(" · ")} +${villes.length - 2}`}
            {job.criteres.seniorite ? ` · ${job.criteres.seniorite}` : ""}
          </p>
        </div>
        <JobStatusBadge statut={job.statut} />
      </div>

      {job.criteres.competences.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {job.criteres.competences.slice(0, 4).map((c) => (
            <Pill key={c}>{c}</Pill>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
        <span className="text-[13px] text-ink-soft">
          <span className="font-bold text-ink">{job.shortlistCount ?? "—"}</span> candidats
        </span>
        <span className="text-[13px] font-medium text-accent opacity-0 transition-opacity group-hover:opacity-100">
          Voir la shortlist →
        </span>
      </div>
    </Link>
  );
}
