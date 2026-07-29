"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/Modal";
import { changerRole, retirerMembre, revoquerInvitation } from "./actions";

function LienDanger({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button onClick={onClick} className="text-[13px] font-medium text-ink-faint transition-colors hover:text-danger">
      {children}
    </button>
  );
}

export function MembreActions({ id, email, role }: { id: string; email: string; role: string }) {
  const [confirmer, setConfirmer] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const nouveauRole = role === "admin" ? "recruteur" : "admin";

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() =>
          start(async () => {
            const res = await changerRole(id, nouveauRole);
            if (res?.error) setErreur(res.error);
          })
        }
        disabled={pending}
        className="text-[13px] font-medium text-ink-faint transition-colors hover:text-accent disabled:opacity-50"
      >
        {role === "admin" ? "Passer recruteur" : "Passer admin"}
      </button>
      <LienDanger onClick={() => setConfirmer(true)}>Retirer</LienDanger>

      {confirmer && (
        <ConfirmDialog
          titre="Retirer ce membre ?"
          description={`${email} perdra immédiatement l'accès à l'agence. Les postes, candidats et notes de l'agence sont conservés.`}
          libelleConfirmer="Retirer"
          pending={pending}
          erreur={erreur}
          onClose={() => {
            setConfirmer(false);
            setErreur(null);
          }}
          onConfirm={() =>
            start(async () => {
              const res = await retirerMembre(id);
              if (res?.error) setErreur(res.error);
              else setConfirmer(false);
            })
          }
        />
      )}

      {/* Erreur hors dialogue (ex. changement de rôle refusé). */}
      {erreur && !confirmer && <span className="text-[12px] font-medium text-danger">{erreur}</span>}
    </div>
  );
}

export function InvitationActions({ id, email }: { id: string; email: string }) {
  const [confirmer, setConfirmer] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <>
      <LienDanger onClick={() => setConfirmer(true)}>Révoquer</LienDanger>
      {confirmer && (
        <ConfirmDialog
          titre="Révoquer l'invitation ?"
          description={`Le lien envoyé à ${email} cessera immédiatement de fonctionner.`}
          libelleConfirmer="Révoquer"
          pending={pending}
          erreur={erreur}
          onClose={() => {
            setConfirmer(false);
            setErreur(null);
          }}
          onConfirm={() =>
            start(async () => {
              const res = await revoquerInvitation(id);
              if (res?.error) setErreur(res.error);
              else setConfirmer(false);
            })
          }
        />
      )}
    </>
  );
}
