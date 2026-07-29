"use client";

import { useRef, useState } from "react";
import { apercuCvtheque, importCvtheque, type ImportPreview } from "./actions";

/** Colonnes reconnues à l'import, avec leurs variantes acceptées. */
const COLONNES = [
  { nom: "linkedin", variantes: "linkedin, url linkedin, profil linkedin", cle: true },
  { nom: "email", variantes: "email, e-mail, mail, courriel", cle: true },
  { nom: "prenom", variantes: "prenom, prénom, first name" },
  { nom: "nom", variantes: "nom, last name, nom de famille" },
  { nom: "telephone", variantes: "telephone, téléphone, tel, mobile" },
  { nom: "poste", variantes: "poste, titre, fonction, job title" },
  { nom: "entreprise", variantes: "entreprise, société, company, employeur" },
  { nom: "ville", variantes: "ville, localisation, city, région" },
];

const MODELE_CSV = [
  "prenom;nom;email;telephone;linkedin;poste;entreprise;ville",
  "Salma;Benali;salma.benali@exemple.ma;+212612345678;https://www.linkedin.com/in/exemple;Directrice financière;Attijari Capital;Casablanca",
  "Youssef;El Amrani;youssef@exemple.ma;;https://www.linkedin.com/in/exemple2;Ingénieur DevOps;OCP Group;Casablanca",
].join("\n");

type Etape = "ferme" | "choix" | "analyse" | "confirmation" | "import" | "resultat";

export function ImportButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [etape, setEtape] = useState<Etape>("ferme");
  const [fichier, setFichier] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState(false);
  const [resultat, setResultat] = useState<{ avecLinkedin: number; exploitables: number } | null>(null);

  function fermer() {
    setEtape("ferme");
    setFichier(null);
    setPreview(null);
    setMessage(null);
    setErreur(false);
    setResultat(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFichier(f);
    setEtape("analyse");
    setMessage(null);
    setErreur(false);

    const fd = new FormData();
    fd.append("file", f);
    const res = await apercuCvtheque(fd);
    if (!res.ok) {
      setMessage(res.message);
      setErreur(true);
      setEtape("choix");
      return;
    }
    setPreview(res.preview);
    setEtape("confirmation");
  }

  async function confirmer() {
    if (!fichier) return;
    setEtape("import");
    const fd = new FormData();
    fd.append("file", fichier);
    const res = await importCvtheque(fd);
    setMessage(res.message);
    setErreur(!res.ok);
    setResultat(
      res.ok && res.avecLinkedin !== undefined && res.exploitables !== undefined
        ? { avecLinkedin: res.avecLinkedin, exploitables: res.exploitables }
        : null,
    );
    setEtape("resultat");
  }

  function telechargerModele() {
    // Le BOM force Excel à lire l'UTF-8 : sans lui, les accents des en-têtes
    // s'affichent en charabia et le cabinet croit le modèle cassé.
    const blob = new Blob(["﻿" + MODELE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modele-cvtheque-recruitai.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
      <button
        onClick={() => setEtape("choix")}
        className="rounded-xl border border-line-strong bg-paper-2 px-4 py-2 text-[14px] font-medium text-ink transition-colors hover:bg-paper disabled:opacity-50"
      >
        ↑ Importer un CSV
      </button>

      {etape !== "ferme" && (
        <div
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:p-6"
          onClick={() => etape !== "import" && etape !== "analyse" && fermer()}
        >
          <div
            className="card my-auto w-[620px] max-w-full p-5 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {(etape === "choix" || etape === "analyse") && (
              <EtapeChoix
                enCours={etape === "analyse"}
                message={message}
                erreur={erreur}
                onChoisir={() => inputRef.current?.click()}
                onModele={telechargerModele}
                onFermer={fermer}
              />
            )}

            {etape === "confirmation" && preview && (
              <EtapeConfirmation
                preview={preview}
                nomFichier={fichier?.name ?? ""}
                onConfirmer={confirmer}
                onAnnuler={fermer}
              />
            )}

            {etape === "import" && (
              <div className="grid place-items-center gap-3 py-10 text-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                <p className="text-[14px] text-ink-soft">Import en cours…</p>
              </div>
            )}

            {etape === "resultat" && (
              <EtapeResultat message={message} erreur={erreur} resultat={resultat} onFermer={fermer} />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function EtapeChoix({
  enCours,
  message,
  erreur,
  onChoisir,
  onModele,
  onFermer,
}: {
  enCours: boolean;
  message: string | null;
  erreur: boolean;
  onChoisir: () => void;
  onModele: () => void;
  onFermer: () => void;
}) {
  return (
    <>
      <h2 className="text-[19px] font-extrabold tracking-tight text-ink">Importer votre CVthèque</h2>
      <p className="mt-1 text-[14px] text-ink-soft">
        Un export CSV de votre ATS ou de votre tableur. Rien n'est enregistré avant votre confirmation.
      </p>

      {/* L'avertissement le plus important : sans LinkedIn, le module ne
          détectera jamais de signal, et le cabinet ne comprendrait pas pourquoi. */}
      <div className="mt-4 rounded-xl border border-amber/40 bg-amber/10 p-3.5">
        <p className="text-[13px] font-semibold text-ink">La colonne LinkedIn est la plus importante</p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
          C'est en relisant les profils LinkedIn que RecruitAI détecte les changements de poste. Un fichier
          sans URL LinkedIn s'importera correctement, mais ne produira <strong>aucun signal chaud</strong>.
        </p>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-ink-faint">
          Colonnes reconnues
        </p>
        <div className="max-h-[190px] overflow-y-auto rounded-lg border border-line">
          <table className="w-full text-left text-[13px]">
            <tbody>
              {COLONNES.map((c) => (
                <tr key={c.nom} className="border-b border-line last:border-0">
                  <td className="px-3 py-1.5 font-medium text-ink">
                    {c.nom}
                    {c.cle && <span className="ml-1.5 text-[11px] font-bold text-accent">requis*</span>}
                  </td>
                  <td className="px-3 py-1.5 text-ink-faint">{c.variantes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1.5 text-[12px] text-ink-faint">
          * au moins l'un des deux : une ligne sans email <em>ni</em> LinkedIn est ignorée. Les autres
          colonnes de votre fichier sont simplement laissées de côté. Séparateur point-virgule, virgule ou
          tabulation — détecté automatiquement.
        </p>
      </div>

      {message && (
        <p
          className={`mt-4 rounded-lg px-3 py-2 text-[13px] font-medium ${erreur ? "bg-danger-soft text-danger" : "text-ink-soft"}`}
        >
          {message}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <button onClick={onModele} className="text-[13px] font-semibold text-accent hover:underline">
          ↓ Télécharger un modèle
        </button>
        <div className="flex gap-2">
          <button
            onClick={onFermer}
            disabled={enCours}
            className="rounded-lg border border-line px-4 py-2 text-[14px] text-ink-soft hover:text-ink"
          >
            Annuler
          </button>
          <button
            onClick={onChoisir}
            disabled={enCours}
            className="rounded-lg bg-accent px-4 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-accent-ink disabled:opacity-50"
          >
            {enCours ? "Lecture du fichier…" : "Choisir un fichier"}
          </button>
        </div>
      </div>
    </>
  );
}

function EtapeConfirmation({
  preview,
  nomFichier,
  onConfirmer,
  onAnnuler,
}: {
  preview: ImportPreview;
  nomFichier: string;
  onConfirmer: () => void;
  onAnnuler: () => void;
}) {
  const partLinkedin = preview.exploitables > 0 ? preview.avecLinkedin / preview.exploitables : 0;
  const alerteLinkedin = partLinkedin < 0.5;

  return (
    <>
      <h2 className="text-[19px] font-extrabold tracking-tight text-ink">Vérifiez avant d'importer</h2>
      <p className="mt-1 truncate text-[13px] text-ink-faint">{nomFichier}</p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Chiffre valeur={preview.lignesLues} libelle="lignes lues" />
        <Chiffre valeur={preview.exploitables} libelle="profils retenus" accent />
        <Chiffre valeur={preview.doublonsDansLeFichier} libelle="doublons fusionnés" />
        <Chiffre valeur={preview.ignoresSansIdentifiant} libelle="lignes ignorées" />
      </div>

      {preview.ignoresSansIdentifiant > 0 && (
        <p className="mt-3 text-[13px] text-ink-soft">
          {preview.ignoresSansIdentifiant} ligne{preview.ignoresSansIdentifiant > 1 ? "s" : ""} sans email
          ni URL LinkedIn {preview.ignoresSansIdentifiant > 1 ? "seront ignorées" : "sera ignorée"} : ces
          contacts ne sont ni identifiables ni relançables.
        </p>
      )}

      <div
        className={`mt-3 rounded-xl border p-3.5 ${alerteLinkedin ? "border-amber/40 bg-amber/10" : "border-emerald/30 bg-emerald/10"}`}
      >
        <p className="text-[13px] font-semibold text-ink">
          {preview.avecLinkedin} profil{preview.avecLinkedin > 1 ? "s" : ""} sur {preview.exploitables} avec
          une URL LinkedIn ({Math.round(partLinkedin * 100)} %)
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
          {alerteLinkedin
            ? "Moins de la moitié de vos profils pourront être enrichis. Les autres resteront en base sans jamais produire de signal chaud. Si votre ATS exporte les URL LinkedIn, ajoutez cette colonne avant d'importer."
            : "La détection des signaux chauds fonctionnera sur ces profils."}
        </p>
      </div>

      {preview.colonnesIgnorees.length > 0 && (
        <p className="mt-3 text-[12px] text-ink-faint">
          <span className="font-semibold">Colonnes non reprises :</span>{" "}
          {preview.colonnesIgnorees.join(", ")}
        </p>
      )}

      {preview.apercu.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-ink-faint">
            Aperçu des premières fiches
          </p>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[440px] text-left text-[12px]">
              <thead className="bg-paper-2 text-ink-faint">
                <tr>
                  <th className="px-2.5 py-1.5 font-medium">Nom</th>
                  <th className="px-2.5 py-1.5 font-medium">Email</th>
                  <th className="px-2.5 py-1.5 font-medium">Poste</th>
                  <th className="px-2.5 py-1.5 font-medium">LinkedIn</th>
                </tr>
              </thead>
              <tbody>
                {preview.apercu.map((c, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="px-2.5 py-1.5 text-ink">
                      {[c.prenom, c.nom].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="px-2.5 py-1.5 text-ink-soft">{c.email ?? "—"}</td>
                    <td className="px-2.5 py-1.5 text-ink-soft">{c.poste ?? "—"}</td>
                    <td className="px-2.5 py-1.5">
                      {c.linkedinUrl ? (
                        <span className="text-emerald">✓</span>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {preview.blocageQuota && (
        <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-[13px] font-medium text-danger">
          {preview.blocageQuota}
        </p>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onAnnuler}
          className="rounded-lg border border-line px-4 py-2 text-[14px] text-ink-soft hover:text-ink"
        >
          Annuler
        </button>
        <button
          onClick={onConfirmer}
          disabled={preview.exploitables === 0 || preview.blocageQuota !== null}
          className="rounded-lg bg-accent px-4 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-accent-ink disabled:opacity-50"
        >
          Importer {preview.exploitables} profil{preview.exploitables > 1 ? "s" : ""}
        </button>
      </div>
    </>
  );
}

function EtapeResultat({
  message,
  erreur,
  resultat,
  onFermer,
}: {
  message: string | null;
  erreur: boolean;
  resultat: { avecLinkedin: number; exploitables: number } | null;
  onFermer: () => void;
}) {
  const partLinkedin = resultat && resultat.exploitables > 0 ? resultat.avecLinkedin / resultat.exploitables : 1;

  return (
    <>
      <h2 className="text-[19px] font-extrabold tracking-tight text-ink">
        {erreur ? "Import échoué" : "Import terminé"}
      </h2>
      <p
        className={`mt-3 rounded-lg px-3 py-2 text-[14px] ${erreur ? "bg-danger-soft text-danger" : "bg-emerald/10 text-ink-soft"}`}
      >
        {message}
      </p>

      {!erreur && resultat && partLinkedin < 0.5 && (
        <p className="mt-3 rounded-xl border border-amber/40 bg-amber/10 p-3.5 text-[13px] leading-relaxed text-ink-soft">
          <strong className="text-ink">Attention :</strong> seuls {resultat.avecLinkedin} profils sur{" "}
          {resultat.exploitables} ont une URL LinkedIn. Les autres n'apparaîtront jamais dans les profils
          chauds. Réimportez un fichier enrichi de cette colonne pour en profiter — les fiches existantes
          seront mises à jour, pas dupliquées.
        </p>
      )}

      {!erreur && (
        <p className="mt-3 text-[13px] text-ink-soft">
          L'enrichissement passera cette nuit à 2h et signalera les candidats ayant changé de poste.
        </p>
      )}

      <div className="mt-5 flex justify-end">
        <button
          onClick={onFermer}
          className="rounded-lg bg-accent px-4 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-accent-ink"
        >
          Fermer
        </button>
      </div>
    </>
  );
}

function Chiffre({ valeur, libelle, accent }: { valeur: number; libelle: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-2.5 ${accent ? "border-accent/40 bg-accent-soft" : "border-line bg-paper"}`}>
      <div className={`text-[20px] font-extrabold ${accent ? "text-accent" : "text-ink"}`}>{valeur}</div>
      <div className="text-[11px] leading-tight text-ink-faint">{libelle}</div>
    </div>
  );
}
