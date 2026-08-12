"use client";

import { useState } from "react";
import { SECTEURS } from "@recruitai/types";
import { VillesInput } from "@/components/VillesInput";
import { createJob } from "./actions";

export function NewJobButton() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  // Le secteur pilote les exemples des deux champs libres. Un cabinet qui
  // recrute en hôtellerie ne doit jamais lire « Développeur React ».
  const [secteur, setSecteur] = useState<string>("");

  const modele = SECTEURS.find((s) => s.cle === secteur);

  async function action(formData: FormData) {
    setPending(true);
    try {
      await createJob(formData);
      setOpen(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl bg-accent px-4 py-2 text-[14px] font-medium text-white transition-colors hover:bg-accent-ink"
      >
        + Nouveau poste
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="card w-[440px] max-w-[92vw] p-6 animate-rise-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-1 font-display text-xl font-bold">Nouveau poste</h2>
            <p className="mb-5 text-[13px] text-ink-soft">
              L'agent IA sourcera et scorera des candidats dès demain matin.
            </p>
            <form action={action} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] text-ink-soft">
                  Secteur d'activité <span className="text-ink-faint">(facultatif)</span>
                </label>
                <select
                  name="secteur"
                  value={secteur}
                  onChange={(e) => setSecteur(e.target.value)}
                  className="rounded-lg border border-line bg-card px-3 py-2 text-[14px] text-ink outline-none focus:border-accent"
                >
                  <option value="">Tous secteurs</option>
                  {SECTEURS.map((s) => (
                    <option key={s.cle} value={s.cle}>
                      {s.libelle}
                    </option>
                  ))}
                </select>
                <span className="text-[12px] text-ink-faint">
                  Sert à départager les métiers de même intitulé — un chargé de clientèle en
                  banque n'est pas celui d'un opérateur télécom.
                </span>
              </div>
              <Field
                name="titre"
                label="Intitulé du poste"
                placeholder={modele?.exempleTitre ?? "Intitulé du poste à pourvoir"}
                required
              />
              <VillesInput />
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] text-ink-soft">Séniorité</label>
                <select
                  name="seniorite"
                  className="rounded-lg border border-line bg-card px-3 py-2 text-[14px] text-ink outline-none focus:border-accent"
                >
                  <option value="">Indifférent</option>
                  <option value="junior">Junior</option>
                  <option value="confirme">Confirmé</option>
                  <option value="senior">Senior</option>
                  <option value="lead">Lead</option>
                </select>
              </div>
              <Field
                name="competences"
                label="Compétences (séparées par des virgules)"
                placeholder={modele?.exempleCompetences ?? "Compétences attendues, séparées par des virgules"}
              />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="rounded-lg border border-line px-4 py-2 text-[14px] text-ink-soft hover:text-ink"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-accent px-4 py-2 text-[14px] font-medium text-white hover:bg-accent disabled:opacity-50"
                >
                  {pending ? "Création…" : "Créer le poste"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  name,
  label,
  placeholder,
  required,
}: {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] text-ink-soft">{label}</label>
      <input
        name={name}
        placeholder={placeholder}
        required={required}
        className="rounded-lg border border-line bg-card px-3 py-2 text-[14px] text-ink outline-none placeholder:text-ink-faint focus:border-accent"
      />
    </div>
  );
}
