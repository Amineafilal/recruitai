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
    <div className="flex items-center gap-3">
      {resultat && <span className="text-[12px] font-medium text-emerald">{resultat}</span>}

      <button
        onClick={() => {
          setResultat(null);
          setDialogue("envoi");
        }}
        className="text-[13px] font-medium text-ink-faint transition-colors hover:text-accent"
      >
        Envoyer maintenant
      </button>
      <button
        onClick={() => setDialogue("edition")}
        className="text-[13px] font-medium text-ink-faint transition-colors hover:text-accent"
      >
        Modifier
      </button>
      <button
        onClick={() => setDialogue("suppression")}
        className="text-[13px] font-medium text-ink-faint transition-colors hover:text-danger"
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
