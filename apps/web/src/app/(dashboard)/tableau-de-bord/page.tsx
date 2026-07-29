import Link from "next/link";
import { PageHeader } from "@/components/CockpitShell";
import { StatTile } from "@/components/StatTile";
import { ScoreRing } from "@/components/ScoreRing";
import { SourcingAreaChart, SourceBarChart } from "@/components/Charts";
import { apiFetch } from "@/lib/api";

export const dynamic = "force-dynamic";

interface DashboardData {
  postesOuverts: number;
  postesTotal: number;
  candidatsTotal: number;
  candidatsAValider: number;
  candidatsValides: number;
  candidatsRejetes: number;
  candidatsTraites: number;
  candidatsNonNotes: number;
  cvthequeTotal: number;
  cvthequeChauds: number;
  campagnesActives: number;
  scoreMoyen: number;
  parJour: { jour: string; n: number }[];
  parSource: { source: string; n: number }[];
  recents: { id: string; nom: string; titre: string; score: number | null; source: string; statut: string }[];
}

function I({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {d.split("|").map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

const STATUT: Record<string, { label: string; cls: string }> = {
  a_valider: { label: "À valider", cls: "bg-amber-soft text-amber" },
  valide: { label: "Validé", cls: "bg-emerald-soft text-emerald" },
  rejete: { label: "Rejeté", cls: "bg-paper-2 text-ink-faint" },
};

export default async function TableauDeBordPage() {
  const d = await apiFetch<DashboardData>("/dashboard");

  // Taux calculé sur les seuls candidats tranchés (validés + rejetés). Le
  // rapporter au total mélangerait la qualité du sourcing avec le retard de
  // traitement : une pile de « à valider » ferait chuter le taux sans qu'un
  // seul candidat ait été jugé mauvais.
  const tauxValidation =
    d.candidatsTraites > 0 ? Math.round((d.candidatsValides / d.candidatsTraites) * 100) : null;

  return (
    <>
      <PageHeader
        eyebrow="Vue d'ensemble"
        title="Tableau de bord"
        subtitle="L'activité de sourcing et de réactivation de votre agence."
      />

      {/* Cartes de stats */}
      <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Postes actifs"
          value={d.postesOuverts}
          accent="accent"
          icon={<I d="M3 7h18v13H3z|M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />}
          hint={`sur ${d.postesTotal} postes`}
          delay={0}
        />
        <StatTile
          label="Candidats sourcés"
          value={d.candidatsTotal.toLocaleString("fr-FR")}
          accent="violet"
          icon={<I d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2|M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z|M22 21v-2a4 4 0 0 0-3-3.87|M16 3.13a4 4 0 0 1 0 7.75" />}
          hint={`${d.candidatsAValider} à valider`}
          delay={60}
        />
        <StatTile
          label="Profils CVthèque"
          value={d.cvthequeTotal.toLocaleString("fr-FR")}
          accent="emerald"
          icon={<I d="M12 2 3 7l9 5 9-5-9-5z|M3 12l9 5 9-5|M3 17l9 5 9-5" />}
          hint={`${d.cvthequeChauds} chauds`}
          delay={120}
        />
        <StatTile
          label="Taux de validation"
          value={tauxValidation === null ? "—" : `${tauxValidation} %`}
          accent="amber"
          icon={<I d="M22 11.08V12a10 10 0 1 1-5.93-9.14|m9 11 3 3L22 4" />}
          hint={
            tauxValidation === null
              ? "aucun candidat encore traité"
              : `${d.candidatsValides} retenu${d.candidatsValides > 1 ? "s" : ""} sur ${d.candidatsTraites} traité${d.candidatsTraites > 1 ? "s" : ""}`
          }
          delay={180}
        />
      </div>

      {/* Le score moyen mérite sa propre ligne : accolé au taux de validation,
          il laissait croire à un lien de cause à effet entre les deux. */}
      <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="card flex items-center justify-between p-5">
          <div>
            <p className="text-[13px] text-ink-soft">Score moyen des candidats notés</p>
            <p className="mt-1 text-[24px] font-extrabold tracking-tight text-ink">
              {d.candidatsTotal > 0 ? `${d.scoreMoyen}/100` : "—"}
            </p>
            <p className="mt-0.5 text-[12px] text-ink-faint">
              mesure la pertinence du sourcing, indépendamment de vos décisions
            </p>
          </div>
          <ScoreRing score={d.candidatsTotal > 0 ? d.scoreMoyen : null} size={60} />
        </div>

        <div className="card flex flex-col justify-center p-5">
          <p className="text-[13px] text-ink-soft">Reste à traiter</p>
          <p className="mt-1 text-[24px] font-extrabold tracking-tight text-ink">{d.candidatsAValider}</p>
          <p className="mt-0.5 text-[12px] text-ink-faint">
            {d.candidatsNonNotes > 0
              ? `dont ${d.candidatsNonNotes} que l'IA n'a pas pu noter`
              : "candidats en attente de votre décision"}
          </p>
        </div>
      </div>

      {/* Graphiques */}
      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-ink">Candidats sourcés</h3>
            <span className="text-[12px] text-ink-faint">14 derniers jours</span>
          </div>
          <SourcingAreaChart data={d.parJour} />
        </div>
        <div className="card p-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-ink">Par source</h3>
          </div>
          {d.parSource.length > 0 ? (
            <SourceBarChart data={d.parSource} />
          ) : (
            <div className="grid h-[240px] place-items-center text-[13px] text-ink-faint">
              Aucune donnée pour l'instant
            </div>
          )}
        </div>
      </div>

      {/* Candidats récents */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-[15px] font-bold text-ink">Candidats récents</h3>
          <Link href="/postes" className="text-[13px] font-medium text-accent hover:underline">
            Voir les postes →
          </Link>
        </div>
        {d.recents.length === 0 ? (
          <div className="grid place-items-center px-6 py-14 text-center">
            <p className="text-[15px] font-semibold text-ink">Pas encore de candidats</p>
            <p className="mt-1 text-[13px] text-ink-soft">Créez un poste : l'agent IA source automatiquement.</p>
          </div>
        ) : (
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
              {d.recents.map((c, i) => {
                const st = STATUT[c.statut] ?? STATUT.a_valider;
                return (
                  <tr
                    key={c.id}
                    className="animate-rise-in border-b border-line last:border-0 hover:bg-paper-2"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <td className="px-5 py-3.5 font-semibold text-ink">{c.nom}</td>
                    <td className="max-w-[280px] truncate px-5 py-3.5 text-ink-soft">{c.titre || "—"}</td>
                    <td className="px-5 py-3.5 text-ink-soft capitalize">{c.source}</td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono font-bold text-ink">{c.score}</span>
                      <span className="text-ink-faint">/100</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`rounded-md px-2 py-0.5 text-[12px] font-semibold ${st.cls}`}>{st.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </>
  );
}
