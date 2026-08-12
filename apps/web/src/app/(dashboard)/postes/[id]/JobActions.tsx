"use client";

import { useState, useTransition } from "react";
import { SECTEURS } from "@recruitai/types";
import { Modal, ConfirmDialog } from "@/components/Modal";
import { VillesInput } from "@/components/VillesInput";
import { villesJob, type JobView } from "@/lib/view-types";
import { deleteJob, relancerSourcing, setJobStatus, updateJob } from "../actions";

type Dialogue = null | "edition" | "suppression" | "relance";

export function JobActions({ job }: { job: JobView }) {
  const [dialogue, setDialogue] = useState<Dialogue>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function fermer() {
    setDialogue(null);
    setErreur(null);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={job.statut}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            await setJobStatus(job.id, e.target.value as "ouvert" | "en_pause" | "clos");
          })
        }
        className="rounded-lg border border-line bg-card px-3 py-2 text-[13px] text-ink outline-none focus:border-accent disabled:opacity-50"
        aria-label="Statut du poste"
      >
        <option value="ouvert">Ouvert</option>
        <option value="en_pause">En pause</option>
        <option value="clos">Clos</option>
      </select>

      <button
        onClick={() => setDialogue("relance")}
        className="rounded-lg border border-line px-3 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:text-ink"
      >
        Relancer la recherche
      </button>
      <button
        onClick={() => setDialogue("edition")}
        className="rounded-lg border border-line px-3 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:text-ink"
      >
        Modifier
      </button>
      <button
        onClick={() => setDialogue("suppression")}
        className="rounded-lg border border-line px-3 py-2 text-[13px] font-medium text-ink-faint transition-colors hover:border-danger/40 hover:text-danger"
      >
        Supprimer
      </button>

      {dialogue === "edition" && (
        <Modal
          titre="Modifier le poste"
          description="La recherche n'est pas relancée automatiquement — utilisez « Relancer la recherche » si besoin."
          onClose={fermer}
          bloque={pending}
          largeur="w-[520px]"
        >
          <form
            action={(fd) =>
              start(async () => {
                const res = await updateJob(job.id, fd);
                if (res?.error) setErreur(res.error);
                else fermer();
              })
            }
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] text-ink-soft">
                Secteur d'activité <span className="text-ink-faint">(facultatif)</span>
              </label>
              {/* Repris tel quel du poste : sans ce champ, la moindre
                  modification effacerait silencieusement le secteur. */}
              <select
                name="secteur"
                defaultValue={job.criteres.secteur ?? ""}
                className="rounded-lg border border-line bg-card px-3 py-2 text-[14px] text-ink outline-none focus:border-accent"
              >
                <option value="">Tous secteurs</option>
                {SECTEURS.map((s) => (
                  <option key={s.cle} value={s.cle}>
                    {s.libelle}
                  </option>
                ))}
              </select>
            </div>
            <Champ label="Intitulé du poste" name="titre" defaultValue={job.criteres.titre} required />
            <VillesInput initial={villesJob(job.criteres)} />
            <Champ label="Séniorité" name="seniorite" defaultValue={job.criteres.seniorite ?? ""} />
            <Champ
              label="Compétences (séparées par des virgules)"
              name="competences"
              defaultValue={job.criteres.competences.join(", ")}
            />

            {erreur && (
              <p className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] font-medium text-danger">{erreur}</p>
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
                {pending ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {dialogue === "relance" && (
        <ConfirmDialog
          titre="Relancer la recherche ?"
          description="Une nouvelle passe de scraping et de scoring va démarrer. Elle consomme du quota et prend environ une minute ; les nouveaux candidats s'ajoutent à la shortlist existante."
          libelleConfirmer="Relancer"
          danger={false}
          pending={pending}
          erreur={erreur}
          onClose={fermer}
          onConfirm={() =>
            start(async () => {
              const res = await relancerSourcing(job.id);
              if (res?.error) setErreur(res.error);
              else fermer();
            })
          }
        />
      )}

      {dialogue === "suppression" && (
        <ConfirmDialog
          titre="Supprimer ce poste ?"
          description={`« ${job.criteres.titre} » et toute sa shortlist (candidats sourcés et notes associées) seront définitivement supprimés. Cette action est irréversible.`}
          libelleConfirmer="Supprimer définitivement"
          pending={pending}
          erreur={erreur}
          onClose={fermer}
          onConfirm={() =>
            start(async () => {
              const res = await deleteJob(job.id);
              if (res?.error) setErreur(res.error);
            })
          }
        />
      )}
    </div>
  );
}

function Champ({
  label,
  name,
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] text-ink-soft">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="rounded-lg border border-line bg-card px-3 py-2 text-[14px] text-ink outline-none placeholder:text-ink-faint focus:border-accent"
      />
    </label>
  );
}
