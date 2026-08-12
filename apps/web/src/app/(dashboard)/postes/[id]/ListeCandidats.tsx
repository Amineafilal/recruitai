"use client";

import { useState, type ReactNode } from "react";
import { CandidateCard } from "@/components/CandidateCard";
import { candidateName, type SourcingCandidateView } from "@/lib/view-types";

type Statut = "a_valider" | "valide" | "rejete";

const ONGLETS = [
  { cle: "a_valider", libelle: "À valider" },
  { cle: "valide", libelle: "Validés" },
  { cle: "rejete", libelle: "Rejetés" },
] as const;

/**
 * Liste de shortlist répartie en trois onglets, pensée comme une FILE DE
 * TRAITEMENT plutôt que comme un tableau à consulter.
 *
 * Le candidat tranché quitte immédiatement l'onglet « À valider » et le
 * suivant remonte à sa place. Le recruteur reste donc sur le même onglet, au
 * même endroit de l'écran, et enchaîne sans jamais naviguer : c'est là que les
 * clics sont économisés, bien plus qu'en raccourcissant un parcours.
 *
 * Le déplacement est appliqué AVANT la réponse du serveur. L'attendre ferait
 * patienter un quart de seconde à chaque décision — sur trente candidats, la
 * liste paraîtrait poussive. En cas d'échec, la carte revient à sa place et
 * l'erreur est dite ; rien n'est perdu en silence.
 */
export function ListeCandidats({
  candidats,
  jobId,
  onValidate,
}: {
  candidats: SourcingCandidateView[];
  /**
   * L'identifiant du poste, et non une fonction construisant le lien : seules
   * les server actions traversent la frontière serveur → client. Une fonction
   * ordinaire passe la compilation TypeScript puis fait échouer la page à
   * l'exécution avec « Functions cannot be passed directly to Client
   * Components ».
   */
  jobId: string;
  onValidate: (id: string, statut: Statut) => Promise<void>;
}) {
  // Décisions prises depuis le chargement, superposées aux données du serveur.
  const [decisions, setDecisions] = useState<Record<string, Statut>>({});
  const [onglet, setOnglet] = useState<Statut>("a_valider");
  const [annulable, setAnnulable] = useState<null | { id: string; nom: string; avant: Statut }>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const statutDe = (c: SourcingCandidateView): Statut =>
    decisions[c.id] ?? ((c.statutValidation as Statut) || "a_valider");

  const groupes: Record<Statut, SourcingCandidateView[]> = {
    a_valider: [],
    valide: [],
    rejete: [],
  };
  for (const c of candidats) groupes[statutDe(c)].push(c);

  async function decider(candidat: SourcingCandidateView, apres: Statut) {
    const avant = statutDe(candidat);
    if (avant === apres) return;

    setErreur(null);
    setDecisions((d) => ({ ...d, [candidat.id]: apres }));
    // On ne propose pas d'annuler une annulation : le candidat est déjà revenu
    // dans la file, le bandeau n'aurait plus rien à dire.
    setAnnulable(apres === "a_valider" ? null : { id: candidat.id, nom: candidateName(candidat.profil), avant });

    try {
      await onValidate(candidat.id, apres);
    } catch {
      setDecisions((d) => ({ ...d, [candidat.id]: avant }));
      setAnnulable(null);
      setErreur(
        `La décision sur ${candidateName(candidat.profil)} n'a pas été enregistrée. ` +
          "Le candidat est resté à sa place, réessayez.",
      );
    }
  }

  const listeCourante = groupes[onglet];

  return (
    <>
      <div className="mb-4 flex items-center gap-1 rounded-lg border border-line bg-card p-1 sm:w-fit">
        {ONGLETS.map((o) => (
          <button
            key={o.cle}
            onClick={() => setOnglet(o.cle)}
            aria-current={onglet === o.cle}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors sm:flex-none ${
              onglet === o.cle ? "bg-accent text-white" : "text-ink-soft hover:text-ink"
            }`}
          >
            {o.libelle}
            {/* Le compte évite d'ouvrir un onglet pour découvrir qu'il est vide. */}
            <span
              className={`rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
                onglet === o.cle ? "bg-white/20 text-white" : "bg-paper-2 text-ink-faint"
              }`}
            >
              {groupes[o.cle].length}
            </span>
          </button>
        ))}
      </div>

      {erreur && (
        <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-[13px] font-medium text-danger">
          {erreur}
        </p>
      )}

      {annulable && (
        // Pas de disparition automatique : un bandeau qui s'efface pendant que
        // la main va vers lui est pire que pas de bandeau du tout.
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-paper-2 px-3 py-2">
          <span className="text-[13px] text-ink-soft">
            <strong className="font-semibold text-ink">{annulable.nom}</strong> déplacé vers «{" "}
            {ONGLETS.find((o) => o.cle === (decisions[annulable.id] ?? "valide"))?.libelle} ».
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const c = candidats.find((x) => x.id === annulable.id);
                if (c) void decider(c, annulable.avant);
              }}
              className="text-[13px] font-semibold text-accent hover:underline"
            >
              Annuler
            </button>
            <button
              onClick={() => setAnnulable(null)}
              aria-label="Masquer"
              className="text-[13px] text-ink-faint hover:text-ink"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {listeCourante.length === 0 ? (
        <VideOnglet onglet={onglet} groupes={groupes} allerA={setOnglet} />
      ) : (
        <div className="flex flex-col gap-3">
          {listeCourante.map((c, i) => (
            <CandidateCard
              key={c.id}
              candidate={c}
              index={i}
              statut={statutDe(c)}
              onValidate={(id, statut) => decider(c, statut)}
              href={`/postes/${jobId}/candidats/${c.id}`}
            />
          ))}
          {/* Depuis « Validés » et « Rejetés », les boutons disparaissent. Sans
              cette issue, revenir sur une décision imposerait de retrouver
              l'onglet à la main. */}
          {onglet !== "a_valider" && (
            <p className="px-1 text-[12px] text-ink-faint">
              Pour remettre un candidat en file, utilisez « Annuler » juste après la décision, ou
              ouvrez sa fiche.
            </p>
          )}
        </div>
      )}
    </>
  );
}

function VideOnglet({
  onglet,
  groupes,
  allerA,
}: {
  onglet: Statut;
  groupes: Record<Statut, SourcingCandidateView[]>;
  allerA: (s: Statut) => void;
}) {
  if (onglet === "a_valider") {
    const traites = groupes.valide.length + groupes.rejete.length;
    return (
      <Vide titre={traites > 0 ? "File vide — tout est traité." : "Aucun candidat à valider."}>
        {traites > 0 && (
          <>
            {groupes.valide.length > 0 && (
              <Lien onClick={() => allerA("valide")}>
                Voir les {groupes.valide.length} validé{groupes.valide.length > 1 ? "s" : ""}
              </Lien>
            )}
            {groupes.rejete.length > 0 && (
              <Lien onClick={() => allerA("rejete")}>
                Voir les {groupes.rejete.length} rejeté{groupes.rejete.length > 1 ? "s" : ""}
              </Lien>
            )}
          </>
        )}
      </Vide>
    );
  }
  return (
    <Vide
      titre={
        onglet === "valide" ? "Aucun candidat validé pour l'instant." : "Aucun candidat rejeté."
      }
    >
      {groupes.a_valider.length > 0 && (
        <Lien onClick={() => allerA("a_valider")}>
          Traiter les {groupes.a_valider.length} candidat{groupes.a_valider.length > 1 ? "s" : ""} en
          attente
        </Lien>
      )}
    </Vide>
  );
}

function Vide({ titre, children }: { titre: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-10 text-center">
      <p className="text-[14px] font-medium text-ink">{titre}</p>
      <div className="flex flex-wrap items-center justify-center gap-4">{children}</div>
    </div>
  );
}

function Lien({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className="text-[13px] font-semibold text-accent hover:underline">
      {children}
    </button>
  );
}
