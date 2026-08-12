"use client";

import { useState, useTransition } from "react";
import { CampaignForm, type CampaignDefaults } from "@/components/CampaignForm";
import { ConfirmDialog } from "@/components/Modal";
import { deleteCampaign, envoyerMaintenant, updateCampaign } from "./actions";

export interface CampaignFull extends CampaignDefaults {
  id: string;
  statut: string;
}

type Dialogue = null | "edition" | "suppression" | "envoi";

export function CampaignActions({ campagne }: { campagne: CampaignFull }) {
  const [dialogue, setDialogue] = useState<Dialogue>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function fermer() {
    setDialogue(null);
    setErreur(null);
  }

  return (
    // shrink-0 : sur mobile, ce bloc cédait zéro pixel et étranglait le nom de
    // la campagne à 97 px. Il passe désormais sous le texte au lieu de le
    // comprimer.
    <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
      {resultat && (
        <span className="rounded-md bg-emerald-soft px-2 py-1 text-[12px] font-semibold text-emerald">
          {resultat}
        </span>
      )}

      {/* L'action qui expédie de vrais emails porte seule un contour : elle est
          irréversible, elle ne doit pas se confondre avec « Modifier ». */}
      <button
        onClick={() => {
          setResultat(null);
          setDialogue("envoi");
        }}
        className="rounded-lg border border-accent/40 px-3 py-1.5 text-[13px] font-semibold text-accent transition-colors hover:bg-accent-soft"
      >
        Envoyer maintenant
      </button>
      <button
        onClick={() => setDialogue("edition")}
        className="rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-ink-soft transition-colors hover:bg-paper-2 hover:text-ink"
      >
        Modifier
      </button>
      <button
        onClick={() => setDialogue("suppression")}
        aria-label={`Supprimer la campagne ${campagne.nom}`}
        className="rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger"
      >
        Supprimer
      </button>

      {dialogue === "edition" && (
        <CampaignForm
          initial={campagne}
          onClose={fermer}
          onSubmit={(fd) => updateCampaign(campagne.id, fd)}
        />
      )}

      {dialogue === "envoi" && (
        <ConfirmDialog
          titre="Envoyer les relances maintenant ?"
          description="Les emails partent immédiatement aux candidats chauds éligibles. Les désinscrits et les candidats déjà contactés récemment restent exclus."
          libelleConfirmer="Envoyer"
          danger={false}
          pending={pending}
          erreur={erreur}
          onClose={fermer}
          onConfirm={() =>
            start(async () => {
              const res = await envoyerMaintenant(campagne.id);
              if (!res.ok) setErreur(res.message ?? "Envoi impossible.");
              else {
                setResultat(`${res.envoyes ?? 0} email(s) envoyé(s)`);
                fermer();
              }
            })
          }
        />
      )}

      {dialogue === "suppression" && (
        <ConfirmDialog
          titre="Supprimer cette campagne ?"
          description={`« ${campagne.nom} » et son historique d'envois seront supprimés. Les désinscriptions déjà enregistrées restent conservées.`}
          libelleConfirmer="Supprimer définitivement"
          pending={pending}
          erreur={erreur}
          onClose={fermer}
          onConfirm={() =>
            start(async () => {
              const res = await deleteCampaign(campagne.id);
              if (!res.ok) setErreur(res.message ?? "Suppression impossible.");
              else fermer();
            })
          }
        />
      )}
    </div>
  );
}
