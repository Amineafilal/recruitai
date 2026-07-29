"use client";

import { useState, useTransition } from "react";
import { chargerDemo } from "./actions";

/**
 * État vide de la CVthèque.
 *
 * Une page « CVthèque vide » sans explication laisse le recruteur devant un
 * module dont il ne comprend ni l'intérêt ni le fonctionnement. On explique
 * donc le cycle complet, et on propose de le voir tourner sur des données
 * d'exemple avant d'engager son vrai fichier.
 */
export function EmptyState({ estAdmin }: { estAdmin: boolean }) {
  const [pending, start] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  function charger() {
    start(async () => {
      const res = await chargerDemo();
      if (res.error) setErreur(res.error);
    });
  }

  return (
    <div className="card px-6 py-10 sm:px-10">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft text-accent">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 2 3 7l9 5 9-5-9-5z" />
            <path d="m3 12 9 5 9-5" />
            <path d="m3 17 9 5 9-5" />
          </svg>
        </div>
        <h3 className="text-[19px] font-extrabold tracking-tight text-ink">
          Votre CVthèque dort. Réveillons-la.
        </h3>
        <p className="mx-auto mt-2 max-w-lg text-[14px] leading-relaxed text-ink-soft">
          Les candidats que vous avez rencontrés il y a deux ans ont changé de poste, de ville, d'envie.
          Ce module surveille ces changements et vous signale ceux qui sont à nouveau ouverts à une
          opportunité — sans que vous ayez à rappeler qui que ce soit.
        </p>
      </div>

      <ol className="mx-auto mt-8 grid max-w-3xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Etape
          n={1}
          titre="Vous importez"
          texte="Un export CSV de votre ATS ou de votre Excel. Les doublons sont fusionnés automatiquement."
        />
        <Etape
          n={2}
          titre="On rafraîchit"
          texte="Chaque nuit, les profils les plus anciens sont relus sur LinkedIn."
        />
        <Etape
          n={3}
          titre="Un signal apparaît"
          texte="Changement de poste ou nouveau diplôme : le candidat passe en « chaud »."
          accent
        />
        <Etape
          n={4}
          titre="La relance part"
          texte="Un email personnalisé, uniquement aux profils chauds, avec lien de désinscription."
        />
      </ol>

      <div className="mx-auto mt-8 flex max-w-md flex-col items-center gap-3">
        {estAdmin && (
          <>
            <button
              onClick={charger}
              disabled={pending}
              className="w-full rounded-lg bg-accent px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-accent-ink disabled:opacity-50"
            >
              {pending ? "Chargement…" : "Voir un exemple concret"}
            </button>
            <p className="text-center text-[12px] text-ink-faint">
              Charge 6 profils fictifs dont 2 « chauds ». Rien n'est envoyé, et vous pourrez les retirer
              en un clic.
            </p>
          </>
        )}
        {erreur && (
          <p className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] font-medium text-danger">{erreur}</p>
        )}
      </div>
    </div>
  );
}

function Etape({
  n,
  titre,
  texte,
  accent,
}: {
  n: number;
  titre: string;
  texte: string;
  accent?: boolean;
}) {
  return (
    <li className={`rounded-xl border p-4 ${accent ? "border-accent/40 bg-accent-soft" : "border-line bg-paper"}`}>
      <span
        className={`inline-grid h-6 w-6 place-items-center rounded-full text-[12px] font-bold ${
          accent ? "bg-accent text-white" : "bg-paper-2 text-ink-soft"
        }`}
      >
        {n}
      </span>
      <p className="mt-2 text-[14px] font-semibold text-ink">{titre}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{texte}</p>
    </li>
  );
}
