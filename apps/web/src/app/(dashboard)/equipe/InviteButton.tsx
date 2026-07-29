"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { inviterMembre } from "./actions";

export function InviteButton() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lien, setLien] = useState<string | null>(null);
  const [raison, setRaison] = useState<string | null>(null);

  function fermer() {
    setOpen(false);
    setError(null);
    setLien(null);
    setRaison(null);
  }

  async function action(fd: FormData) {
    setPending(true);
    setError(null);
    const res = await inviterMembre(fd);
    setPending(false);
    if (res.error) setError(res.error);
    else if (res.lien) {
      setLien(res.lien);
      setRaison(res.raison ?? null);
    } else fermer();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl bg-accent px-4 py-2 text-[14px] font-medium text-white transition-colors hover:bg-accent-ink"
      >
        + Inviter un recruteur
      </button>

      {open && (
        <Modal
          titre="Inviter un recruteur"
          description="La personne reçoit un email pour choisir son mot de passe et rejoindre l'agence."
          onClose={fermer}
          bloque={pending}
        >
          {lien ? (
            <div className="flex flex-col gap-4">
              <p className="rounded-lg border border-amber/30 bg-amber/10 px-3 py-2.5 text-[13px] text-ink-soft">
                L'invitation est bien créée, mais l'email n'a pas pu être envoyé
                {raison ? ` — ${raison}` : "."} Transmettez ce lien vous-même : il reste valable 7&nbsp;jours.
              </p>
              <code className="block break-all rounded-lg border border-line bg-paper-2 p-3 font-mono text-[12px] text-ink">
                {lien}
              </code>
              <div className="flex justify-end">
                <button
                  onClick={fermer}
                  className="rounded-lg bg-accent px-4 py-2 text-[14px] font-medium text-white hover:bg-accent-ink"
                >
                  Terminé
                </button>
              </div>
            </div>
          ) : (
            <form action={action} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] text-ink-soft">Email</span>
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="collegue@agence.fr"
                  className="rounded-lg border border-line bg-card px-3 py-2 text-[14px] text-ink outline-none placeholder:text-ink-faint focus:border-accent"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] text-ink-soft">Rôle</span>
                <select
                  name="role"
                  defaultValue="recruteur"
                  className="rounded-lg border border-line bg-card px-3 py-2 text-[14px] text-ink outline-none focus:border-accent"
                >
                  <option value="recruteur">Recruteur — accès aux postes et candidats</option>
                  <option value="admin">Administrateur — peut aussi gérer l'équipe</option>
                </select>
              </label>

              {error && (
                <p className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] font-medium text-danger">{error}</p>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={fermer}
                  disabled={pending}
                  className="rounded-lg border border-line px-4 py-2 text-[14px] text-ink-soft hover:text-ink"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-accent px-4 py-2 text-[14px] font-medium text-white hover:bg-accent-ink disabled:opacity-50"
                >
                  {pending ? "Envoi…" : "Envoyer l'invitation"}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
