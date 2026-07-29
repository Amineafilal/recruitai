"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ScoreRing } from "@/components/ScoreRing";
import { ScoringBadge } from "@/components/badges";
import { candidateName, candidateTitle, type SourcingCandidateView } from "@/lib/view-types";
import { ETAPES, ETAPE_AIDE, ETAPE_COULEURS, ETAPE_LABELS, estEtape, type Etape } from "@/lib/pipeline";
import { deplacerCandidat } from "./actions";

type CandidatPipeline = SourcingCandidateView & { etape?: Etape };

/**
 * Tableau Kanban du pipeline de recrutement.
 *
 * Le déplacement est optimiste : la carte bouge immédiatement, puis l'appel
 * serveur confirme. En cas d'échec on remet la carte où elle était et on le
 * dit — laisser une carte déplacée alors que rien n'a été enregistré ferait
 * croire au recruteur que le candidat a avancé.
 */
export function PipelineBoard({
  candidats: candidatsInitiaux,
  jobId,
}: {
  candidats: CandidatPipeline[];
  jobId: string;
}) {
  const [candidats, setCandidats] = useState(candidatsInitiaux);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const sensors = useSensors(
    // Une distance minimale évite qu'un simple clic sur la carte (pour ouvrir
    // la fiche) soit interprété comme un début de glissement.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  function onDragStart(e: DragStartEvent) {
    setEnCours(String(e.active.id));
    setErreur(null);
  }

  /**
   * Point d'entrée unique du déplacement, partagé par le glisser-déposer et
   * par le menu « Déplacer vers ». Les deux DOIVENT passer par ici : si le
   * menu appelait le serveur de son côté, la carte resterait affichée dans
   * son ancienne colonne jusqu'au rechargement de la page.
   */
  async function deplacer(id: string, cible: Etape) {
    const candidat = candidats.find((c) => c.id === id);
    if (!candidat || (candidat.etape ?? "source") === cible) return;

    setErreur(null);
    const precedente = candidat.etape ?? "source";
    setCandidats((liste) => liste.map((c) => (c.id === id ? { ...c, etape: cible } : c)));

    const res = await deplacerCandidat(id, cible, jobId);
    if (res?.error) {
      setCandidats((liste) => liste.map((c) => (c.id === id ? { ...c, etape: precedente } : c)));
      setErreur(res.error);
    }
  }

  async function onDragEnd(e: DragEndEvent) {
    setEnCours(null);
    const cible = e.over?.id;
    if (!estEtape(cible)) return;
    await deplacer(String(e.active.id), cible);
  }

  const candidatActif = candidats.find((c) => c.id === enCours) ?? null;

  return (
    <div className="flex flex-col gap-3">
      {erreur && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] font-medium text-danger">{erreur}</p>
      )}

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        {/* Défilement horizontal : huit colonnes ne tiennent sur aucun écran. */}
        <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex min-w-max gap-3">
            {ETAPES.map((etape) => (
              <Colonne
                key={etape}
                etape={etape}
                candidats={candidats.filter((c) => (c.etape ?? "source") === etape)}
                jobId={jobId}
                onDeplacer={deplacer}
              />
            ))}
          </div>
        </div>

        {/* Aperçu suivant le curseur pendant le glissement. */}
        <DragOverlay>
          {candidatActif ? <Carte candidat={candidatActif} jobId={jobId} apercu /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function Colonne({
  etape,
  candidats,
  jobId,
  onDeplacer,
}: {
  etape: Etape;
  candidats: CandidatPipeline[];
  jobId: string;
  onDeplacer: (id: string, etape: Etape) => Promise<void>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: etape });
  const couleurs = ETAPE_COULEURS[etape];

  return (
    <div
      ref={setNodeRef}
      className={`flex w-[272px] shrink-0 flex-col rounded-xl border transition-colors ${
        isOver ? "border-accent bg-accent-soft/50" : "border-line bg-paper-2/60"
      }`}
    >
      <div className="flex items-center gap-2 px-3 pb-2 pt-3" title={ETAPE_AIDE[etape]}>
        <span className={`h-2 w-2 shrink-0 rounded-full ${couleurs.barre}`} />
        <h3 className="flex-1 truncate text-[13px] font-bold text-ink">{ETAPE_LABELS[etape]}</h3>
        <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${couleurs.fond} ${couleurs.texte}`}>
          {candidats.length}
        </span>
      </div>

      <div className="flex min-h-[120px] flex-col gap-2 p-2">
        {candidats.length === 0 ? (
          <p className="px-2 py-6 text-center text-[12px] text-ink-faint">
            {isOver ? "Déposer ici" : "—"}
          </p>
        ) : (
          candidats.map((c) => <Carte key={c.id} candidat={c} jobId={jobId} onDeplacer={onDeplacer} />)
        )}
      </div>
    </div>
  );
}

function Carte({
  candidat,
  jobId,
  apercu,
  onDeplacer,
}: {
  candidat: CandidatPipeline;
  jobId: string;
  apercu?: boolean;
  onDeplacer?: (id: string, etape: Etape) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: candidat.id,
    disabled: apercu,
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, opacity: isDragging ? 0.4 : 1 }}
      className={`rounded-lg border border-line bg-card p-2.5 shadow-card ${apercu ? "rotate-2 shadow-card-hover" : ""}`}
    >
      <div className="flex items-start gap-2.5">
        {/* Poignée de glissement séparée du reste : la carte doit rester
            cliquable pour ouvrir la fiche du candidat. */}
        <button
          {...listeners}
          {...attributes}
          aria-label={`Déplacer ${candidateName(candidat.profil)}`}
          className="mt-0.5 cursor-grab touch-none rounded p-0.5 text-ink-faint transition-colors hover:bg-paper-2 hover:text-ink active:cursor-grabbing"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="6" r="1.6" />
            <circle cx="15" cy="6" r="1.6" />
            <circle cx="9" cy="12" r="1.6" />
            <circle cx="15" cy="12" r="1.6" />
            <circle cx="9" cy="18" r="1.6" />
            <circle cx="15" cy="18" r="1.6" />
          </svg>
        </button>

        <ScoreRing score={candidat.score} size={34} />

        <div className="min-w-0 flex-1">
          <a
            href={`/postes/${jobId}/candidats/${candidat.id}`}
            className="block truncate text-[13px] font-semibold text-ink hover:text-accent hover:underline"
          >
            {candidateName(candidat.profil)}
          </a>
          {candidateTitle(candidat.profil) && (
            <p className="truncate text-[11px] text-ink-soft">{candidateTitle(candidat.profil)}</p>
          )}
          <div className="mt-1">
            <ScoringBadge statutScoring={candidat.statutScoring} erreur={candidat.scoringErreur} />
          </div>
        </div>
      </div>

      {!apercu && onDeplacer && <MenuDeplacer candidat={candidat} onDeplacer={onDeplacer} />}
    </div>
  );
}

/**
 * Alternative au glisser-déposer.
 *
 * Indispensable : le glissement est peu praticable au doigt sur une colonne
 * hors écran, et inutilisable au lecteur d'écran. Ce menu couvre les deux cas.
 */
function MenuDeplacer({
  candidat,
  onDeplacer,
}: {
  candidat: CandidatPipeline;
  onDeplacer: (id: string, etape: Etape) => Promise<void>;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [pending, setPending] = useState(false);
  const courante = candidat.etape ?? "source";

  async function deplacer(etape: Etape) {
    setPending(true);
    await onDeplacer(candidat.id, etape);
    setPending(false);
    setOuvert(false);
  }

  return (
    <div className="relative mt-1.5 border-t border-line pt-1.5">
      <button
        onClick={() => setOuvert((o) => !o)}
        disabled={pending}
        className="w-full text-left text-[11px] font-medium text-ink-faint transition-colors hover:text-accent disabled:opacity-50"
      >
        {pending ? "Déplacement…" : "Déplacer vers ▾"}
      </button>

      {ouvert && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOuvert(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 w-full overflow-hidden rounded-lg border border-line bg-card shadow-card-hover">
            {ETAPES.filter((e) => e !== courante).map((e) => (
              <button
                key={e}
                onClick={() => deplacer(e)}
                className="block w-full px-2.5 py-1.5 text-left text-[12px] text-ink-soft transition-colors hover:bg-paper-2 hover:text-ink"
              >
                {ETAPE_LABELS[e]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
