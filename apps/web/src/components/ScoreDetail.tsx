import { PONDERATION_SCORE, type CriteresScoreView } from "@/lib/view-types";

/**
 * Décomposition de la note IA, critère par critère.
 *
 * Un chiffre brut ne se conteste pas : le recruteur le croit ou l'ignore. En
 * montrant les quatre composantes, leur poids et le commentaire de l'IA, il
 * peut vérifier le raisonnement — et repérer lui-même quand le modèle s'est
 * trompé sur un profil.
 */
export function ScoreDetail({
  criteres,
  score,
  documente = true,
}: {
  criteres: CriteresScoreView;
  score: number | null;
  /**
   * Faux quand la source n'a rien renvoyé de vérifiable au-delà de l'intitulé.
   * Le total est alors plafonné, et il faut le dire : sans explication, des
   * composantes à 100 sous un total de 85 passent pour une erreur de calcul.
   */
  documente?: boolean;
}) {
  const noteCompetences = criteres.competences?.note ?? null;

  // Reproduit calculerScore() pour savoir si le plafond s'est appliqué : sans
  // cette mention, un recruteur verrait des composantes hautes et un total bas
  // sans comprendre pourquoi.
  const applicables = PONDERATION_SCORE.filter((c) => criteres[c.cle]?.note !== null);
  const poidsTotal = applicables.reduce((s, c) => s + c.poids, 0);
  const moyenne =
    poidsTotal > 0
      ? applicables.reduce((s, c) => s + (criteres[c.cle]?.note ?? 0) * c.poids, 0) / poidsTotal
      : 0;
  const plafonne = noteCompetences !== null && moyenne > noteCompetences + 25;

  return (
    <section className="card p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-ink-faint">
          Comment ce score est calculé
        </h2>
        {score !== null && (
          <span className="text-[13px] text-ink-soft">
            moyenne pondérée des quatre critères ci-dessous
          </span>
        )}
      </div>

      <div className="flex flex-col gap-3.5">
        {PONDERATION_SCORE.map(({ cle, libelle, poids }) => {
          const c = criteres[cle];
          const note = c?.note ?? null;
          return (
            <div key={cle}>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className="text-[14px] font-medium text-ink">
                  {libelle}
                  <span className="ml-1.5 text-[12px] font-normal text-ink-faint">
                    {Math.round(poids * 100)} %
                  </span>
                </span>
                <span
                  className={`shrink-0 font-mono text-[13px] font-bold tabular-nums ${couleurNote(note)}`}
                >
                  {note === null ? "n/a" : `${note}/100`}
                </span>
              </div>

              <div className="h-1.5 overflow-hidden rounded-full bg-paper-2">
                {note !== null && (
                  <div
                    className={`h-full rounded-full ${fondNote(note)}`}
                    style={{ width: `${note}%` }}
                  />
                )}
              </div>

              {c?.commentaire && (
                <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{c.commentaire}</p>
              )}
            </div>
          );
        })}
      </div>

      {!documente && score !== null && score >= 85 && (
        <p className="mt-4 rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-[13px] leading-relaxed text-ink-soft">
          <strong className="text-ink">Note plafonnée à 85.</strong> La source n'a renvoyé que
          l'intitulé de ce profil — ni employeurs, ni dates, ni formation. L'expérience et la
          séniorité sont donc jugées sur la même phrase, et rien ici n'est vérifiable. Ouvrez le
          profil LinkedIn avant de décider.
        </p>
      )}

      {plafonne && (
        <p className="mt-4 rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-[13px] leading-relaxed text-ink-soft">
          <strong className="text-ink">Note plafonnée.</strong> Les autres critères donnaient{" "}
          {Math.round(moyenne)}/100, mais le reste d'un profil ne peut pas compenser l'absence des
          compétences recherchées : la note ne dépasse pas celle des compétences de plus de 25 points.
        </p>
      )}

      {criteres.localisation?.note === null && (
        <p className="mt-3 text-[12px] text-ink-faint">
          Aucune ville n'est demandée sur ce poste : la localisation est exclue du calcul et son poids
          réparti sur les autres critères.
        </p>
      )}
    </section>
  );
}

function couleurNote(note: number | null): string {
  if (note === null) return "text-ink-faint";
  if (note >= 70) return "text-emerald";
  if (note >= 40) return "text-amber";
  return "text-danger";
}

function fondNote(note: number): string {
  if (note >= 70) return "bg-emerald";
  if (note >= 40) return "bg-amber";
  return "bg-danger";
}
