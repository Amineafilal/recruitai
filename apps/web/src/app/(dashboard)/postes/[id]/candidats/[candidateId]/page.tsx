import Link from "next/link";
import { ScoreRing } from "@/components/ScoreRing";
import { SourceBadge, ValidationBadge, ScoringBadge, Pill } from "@/components/badges";
import { ContactActions } from "./ContactActions";
import { apiFetch } from "@/lib/api";
import { getSessionUser } from "@/lib/session";
import {
  asText,
  candidateName,
  candidateTitle,
  candidateLocation,
  coordonneesCandidat,
  dureeLisible,
  experiencesNormalisees,
  initials,
  skillLabel,
  type CandidateDetailView,
  type ExperienceNormalisee,
} from "@/lib/view-types";
import { ValidationActions } from "./ValidationActions";
import { NotesPanel } from "./NotesPanel";
import { Timeline, type TimelineEventView } from "./Timeline";

export const dynamic = "force-dynamic";

const dateFr = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export default async function CandidatPage({
  params,
}: {
  params: { id: string; candidateId: string };
}) {
  const [{ candidat, poste, notes }, timeline, session] = await Promise.all([
    apiFetch<CandidateDetailView>(`/candidates/${params.candidateId}`),
    apiFetch<TimelineEventView[]>(`/candidates/${params.candidateId}/timeline`),
    getSessionUser(),
  ]);

  const p = candidat.profil;
  const experiences = experiencesNormalisees(p);
  const contact = coordonneesCandidat(p);

  return (
    <>
      <Link
        href={`/postes/${params.id}`}
        className="mb-4 inline-block text-[13px] text-ink-soft hover:text-ink"
      >
        ← {poste?.criteres.titre ?? "Shortlist"}
      </Link>

      {/* En-tête : identité, score et décision */}
      <div className="card mb-6 p-6">
        <div className="flex flex-wrap items-start gap-5">
          <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-accent-soft text-[20px] font-extrabold text-accent">
            {p.pictureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- image externe LinkedIn, pas de loader Next
              <img src={p.pictureUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initials(p)
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[24px] font-extrabold tracking-tight text-ink">{candidateName(p)}</h1>
              <SourceBadge source={candidat.source} />
              <ValidationBadge statut={candidat.statutValidation} />
              <ScoringBadge statutScoring={candidat.statutScoring} erreur={candidat.scoringErreur} />
            </div>
            {(asText(p.headline) || candidateTitle(p)) && (
              <p className="mt-1 text-[14px] text-ink-soft">{asText(p.headline) || candidateTitle(p)}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-faint">
              {candidateLocation(p) && <span>{candidateLocation(p)}</span>}
              <span>Sourcé le {dateFr.format(new Date(candidat.createdAt))}</span>
              {p.linkedinUrl && (
                <a
                  href={p.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-accent hover:underline"
                >
                  Voir le profil LinkedIn ↗
                </a>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-center gap-3">
            <ScoreRing score={candidat.score} size={68} />
            <span className="text-[12px] text-ink-faint">
              {candidat.statutScoring === "echec" ? "non noté" : "score IA"}
            </span>
          </div>
        </div>

        {/* Coordonnées et actions de contact. */}
        <div className="mt-5 border-t border-line pt-5">
          <ContactActions
            nom={candidateName(p)}
            email={contact.email}
            telephone={contact.telephone}
            linkedinUrl={p.linkedinUrl}
          />
        </div>

        <div className="mt-5 border-t border-line pt-5">
          <ValidationActions
            candidateId={candidat.id}
            jobId={params.id}
            statutInitial={candidat.statutValidation}
          />
        </div>
      </div>

      {/* Explication du score : pourquoi cette note, ou pourquoi il n'y en a pas. */}
      {candidat.statutScoring === "echec" ? (
        <div className="card mb-6 border-l-4 border-l-danger p-5">
          <h2 className="mb-1 text-[13px] font-semibold uppercase tracking-wider text-danger">
            Scoring impossible
          </h2>
          <p className="text-[14px] text-ink-soft">
            {candidat.scoringErreur ?? "Le moteur de scoring n'a pas pu évaluer ce profil."}
          </p>
          <p className="mt-2 text-[13px] text-ink-faint">
            Ce candidat a été conservé et sera automatiquement réévalué
            {typeof candidat.scoringTentatives === "number" && candidat.scoringTentatives >= 3
              ? " — nombre maximal de tentatives atteint, une intervention est nécessaire."
              : " lors du prochain passage automatique."}
          </p>
        </div>
      ) : (
        candidat.scoringJustification && (
          <div className="card mb-6 border-l-4 border-l-accent p-5">
            <h2 className="mb-1 text-[13px] font-semibold uppercase tracking-wider text-ink-faint">
              Pourquoi ce score
            </h2>
            <p className="text-[14px] leading-relaxed text-ink-soft">{candidat.scoringJustification}</p>
          </div>
        )
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-6">
          {asText(p.about) && (
            <Section titre="À propos">
              <p className="whitespace-pre-line text-[14px] leading-relaxed text-ink-soft">{asText(p.about)}</p>
            </Section>
          )}

          {experiences.length > 0 && (
            <Section titre="Expérience">
              <div className="flex flex-col gap-4">
                {experiences.map((exp, i) => (
                  <ExperienceLigne key={i} exp={exp} />
                ))}
              </div>
            </Section>
          )}

          {p.education && p.education.length > 0 && (
            <Section titre="Formation">
              <div className="flex flex-col gap-3">
                {p.education.map((ed, i) => (
                  <div key={i}>
                    <p className="text-[14px] font-semibold text-ink">{asText(ed.schoolName)}</p>
                    <p className="text-[13px] text-ink-soft">
                      {[asText(ed.degree), asText(ed.fieldOfStudy)].filter(Boolean).join(" · ")}
                    </p>
                    {asText(ed.period) && (
                      <p className="text-[12px] text-ink-faint">{asText(ed.period)}</p>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {p.skills && p.skills.length > 0 && (
            <Section titre="Compétences">
              <div className="flex flex-wrap gap-1.5">
                {p.skills.map((s, i) => {
                  const label = skillLabel(s);
                  return label ? <Pill key={i}>{label}</Pill> : null;
                })}
              </div>
            </Section>
          )}

          {/* Aucune donnée exploitable : on le dit franchement plutôt que
              d'afficher une page vide qui ferait douter d'un bug. */}
          {!asText(p.about) && experiences.length === 0 && !p.education?.length && !p.skills?.length && (
            <Section titre="Profil détaillé">
              <p className="text-[14px] text-ink-soft">
                L'actor de scraping n'a renvoyé qu'un profil résumé pour ce candidat. Ouvrez son profil
                LinkedIn pour le détail complet.
              </p>
            </Section>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Timeline evenements={timeline} candidateId={candidat.id} jobId={params.id} />
          <NotesPanel
            candidateId={candidat.id}
            jobId={params.id}
            notes={notes}
            moi={session?.id ?? null}
            estAdmin={session?.role === "admin"}
          />
        </div>
      </div>
    </>
  );
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-faint">{titre}</h2>
      {children}
    </section>
  );
}

function ExperienceLigne({ exp }: { exp: ExperienceNormalisee }) {
  const dureeRole = dureeLisible(exp.dureeMois);
  // L'ancienneté dans l'entreprise n'est montrée que si elle dépasse
  // nettement celle du rôle : c'est le cas d'une promotion interne, et
  // l'afficher systématiquement donnerait l'impression d'une contradiction.
  const montrerEntreprise =
    exp.dureeEntrepriseMois !== null &&
    exp.dureeMois !== null &&
    exp.dureeEntrepriseMois > exp.dureeMois + 1;

  return (
    <div className="border-l-2 border-line pl-4">
      <p className="text-[14px] font-semibold text-ink">{exp.titre || "—"}</p>
      <p className="text-[13px] text-ink-soft">{exp.entreprise}</p>
      <p className="text-[12px] text-ink-faint">
        {[
          dureeRole && `${dureeRole} dans ce poste`,
          exp.enCours && "en cours",
          montrerEntreprise && `${dureeLisible(exp.dureeEntrepriseMois)} dans l'entreprise`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {exp.description && (
        <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-ink-soft">
          {exp.description}
        </p>
      )}
    </div>
  );
}
