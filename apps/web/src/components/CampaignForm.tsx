"use client";

import { useRef, useState } from "react";
import { TEMPLATE_VARIABLES } from "@/lib/template-vars";

const TRIGGERS: { value: string; label: string }[] = [
  { value: "manuel", label: "Manuel — tous les candidats chauds" },
  { value: "changement_poste", label: "Changement de poste détecté" },
  { value: "nouveau_diplome", label: "Nouveau diplôme" },
  { value: "activite", label: "Activité LinkedIn récente" },
];

export interface CampaignDefaults {
  nom: string;
  sujet: string;
  template: string;
  declencheur: string;
  delaiMinRelanceJours: number;
}

const TEMPLATE_PAR_DEFAUT =
  "Bonjour {{prenom}},\n\nVotre profil de {{poste}} a retenu notre attention pour un poste que nous recrutons.";

/**
 * Formulaire de campagne réutilisable : création, édition et démo. `onSubmit`
 * reçoit le FormData ; en démo on passe une fonction qui simule le succès.
 * `initial` bascule le formulaire en mode édition (champs pré-remplis).
 */
export function CampaignForm({
  onSubmit,
  onClose,
  initial,
}: {
  onSubmit: (fd: FormData) => Promise<{ ok: boolean; message?: string }>;
  onClose: () => void;
  initial?: CampaignDefaults;
}) {
  const edition = Boolean(initial);
  const templateRef = useRef<HTMLTextAreaElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function insertVariable(v: string) {
    const el = templateRef.current;
    if (!el) return;
    const token = `{{${v}}}`;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    el.value = el.value.slice(0, start) + token + el.value.slice(end);
    el.focus();
    el.selectionStart = el.selectionEnd = start + token.length;
  }

  async function action(fd: FormData) {
    setPending(true);
    setError(null);
    try {
      const res = await onSubmit(fd);
      if (res.ok) onClose();
      else setError(res.message ?? "Erreur lors de la création.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-6 backdrop-blur-sm animate-fade-in"
      onClick={() => !pending && onClose()}
    >
      <div className="card my-auto w-[560px] max-w-[94vw] p-6 animate-rise-in" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-1 font-display text-xl font-bold">
          {edition ? "Modifier la campagne" : "Nouvelle campagne de relance"}
        </h2>
        <p className="mb-5 text-[13px] text-ink-soft">
          Le message part automatiquement aux candidats chauds correspondant au déclencheur.
        </p>

        <form action={action} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-ink-soft">Nom de la campagne</span>
            <input
              name="nom"
              required
              defaultValue={initial?.nom}
              placeholder="Réactivation développeurs fullstack"
              className="rounded-lg border border-line bg-card px-3 py-2 text-[14px] text-ink outline-none placeholder:text-ink-faint focus:border-accent"
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] text-ink-soft">Déclencheur</span>
              <select
                name="declencheur"
                defaultValue={initial?.declencheur ?? "manuel"}
                className="rounded-lg border border-line bg-card px-3 py-2 text-[14px] text-ink outline-none focus:border-accent"
              >
                {TRIGGERS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] text-ink-soft">Délai anti-relance (jours)</span>
              <input
                name="delaiMinRelanceJours"
                type="number"
                min={1}
                defaultValue={initial?.delaiMinRelanceJours ?? 90}
                className="rounded-lg border border-line bg-card px-3 py-2 text-[14px] text-ink outline-none focus:border-accent"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-ink-soft">Sujet de l'email</span>
            <input
              name="sujet"
              required
              defaultValue={initial?.sujet}
              placeholder="{{prenom}}, une opportunité qui pourrait vous intéresser"
              className="rounded-lg border border-line bg-card px-3 py-2 text-[14px] text-ink outline-none placeholder:text-ink-faint focus:border-accent"
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] text-ink-soft">Message</span>
            <textarea
              ref={templateRef}
              name="template"
              required
              rows={5}
              defaultValue={initial?.template ?? TEMPLATE_PAR_DEFAUT}
              className="resize-y rounded-lg border border-line bg-card px-3 py-2 font-mono text-[13px] leading-relaxed text-ink outline-none placeholder:text-ink-faint focus:border-accent"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[12px] text-ink-faint">Insérer :</span>
              {TEMPLATE_VARIABLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVariable(v)}
                  className="rounded-md border border-line bg-paper-2 px-2 py-0.5 font-mono text-[11px] text-blue transition-colors hover:border-blue/40 hover:text-blue"
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
          </div>

          <p className="rounded-lg border border-line bg-paper-2 px-3 py-2 text-[12px] text-ink-faint">
            🛈 Un lien de désinscription est ajouté automatiquement à chaque envoi (obligation RGPD).
            Les candidats désinscrits sont exclus.
          </p>

          {error && <p className="text-[13px] text-accent">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
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
              {pending ? "Enregistrement…" : edition ? "Enregistrer" : "Créer la campagne"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
