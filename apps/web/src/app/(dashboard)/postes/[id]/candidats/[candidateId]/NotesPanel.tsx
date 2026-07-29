"use client";

import { useRef, useState, useTransition } from "react";
import type { CandidateNoteView } from "@/lib/view-types";
import { ajouterNote, supprimerNote } from "./actions";

const dateHeureFr = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Notes de l'équipe sur un candidat : compte-rendu d'appel, prétentions,
 * disponibilité. Visible par toute l'agence — c'est le point du partage.
 */
export function NotesPanel({
  candidateId,
  jobId,
  notes,
  moi,
  estAdmin,
}: {
  candidateId: string;
  jobId: string;
  notes: CandidateNoteView[];
  moi: string | null;
  estAdmin: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function envoyer(fd: FormData) {
    const contenu = String(fd.get("contenu") ?? "");
    start(async () => {
      const res = await ajouterNote(candidateId, jobId, contenu);
      if (res?.error) setErreur(res.error);
      else {
        setErreur(null);
        formRef.current?.reset();
      }
    });
  }

  return (
    <aside className="card flex h-fit flex-col p-5">
      <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-faint">
        Notes de l'équipe {notes.length > 0 && `· ${notes.length}`}
      </h2>

      <form ref={formRef} action={envoyer} className="mb-4 flex flex-col gap-2">
        <textarea
          name="contenu"
          rows={3}
          required
          maxLength={4000}
          placeholder="Appelé le 12/03 : ouvert à une opportunité, préavis 3 mois, cible 55k…"
          className="resize-y rounded-lg border border-line bg-paper px-3 py-2 text-[13px] leading-relaxed text-ink outline-none placeholder:text-ink-faint focus:border-accent focus:ring-2 focus:ring-accent-soft"
        />
        {erreur && <p className="text-[12px] font-medium text-danger">{erreur}</p>}
        <button
          type="submit"
          disabled={pending}
          className="self-end rounded-lg bg-accent px-4 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-accent-ink disabled:opacity-50"
        >
          {pending ? "Ajout…" : "Ajouter"}
        </button>
      </form>

      {notes.length === 0 ? (
        <p className="text-[13px] text-ink-soft">
          Aucune note. Consignez ici vos échanges pour que toute l'agence en profite.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {notes.map((n) => (
            <NoteLigne
              key={n.id}
              note={n}
              candidateId={candidateId}
              jobId={jobId}
              modifiable={n.auteurUserId === moi || estAdmin}
            />
          ))}
        </ul>
      )}
    </aside>
  );
}

function NoteLigne({
  note,
  candidateId,
  jobId,
  modifiable,
}: {
  note: CandidateNoteView;
  candidateId: string;
  jobId: string;
  modifiable: boolean;
}) {
  const [pending, start] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  return (
    <li className="py-3 first:pt-0">
      <p className="whitespace-pre-line text-[13px] leading-relaxed text-ink">{note.contenu}</p>
      <div className="mt-1.5 flex items-center gap-2 text-[12px] text-ink-faint">
        <span>{note.auteurEmail}</span>
        <span>·</span>
        <span>{dateHeureFr.format(new Date(note.createdAt))}</span>
        {modifiable && (
          <button
            onClick={() =>
              start(async () => {
                const res = await supprimerNote(note.id, candidateId, jobId);
                if (res?.error) setErreur(res.error);
              })
            }
            disabled={pending}
            className="ml-auto transition-colors hover:text-danger disabled:opacity-50"
          >
            Supprimer
          </button>
        )}
      </div>
      {erreur && <p className="mt-1 text-[12px] font-medium text-danger">{erreur}</p>}
    </li>
  );
}
