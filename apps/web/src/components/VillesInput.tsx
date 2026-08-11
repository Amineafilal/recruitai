"use client";

import { useState, type KeyboardEvent } from "react";

export const MAX_VILLES = 8;

/**
 * Bassins d'emploi du marché visé : Maroc et Europe francophone.
 *
 * L'ordre compte — seules les premières suggestions sont affichées. La liste
 * précédente listait six villes françaises avant la première ville marocaine,
 * qui n'apparaissait donc jamais. On alterne désormais les deux marchés.
 */
const SUGGESTIONS = [
  "Casablanca",
  "Paris",
  "Rabat",
  "Lyon",
  "Marrakech",
  "Bruxelles",
  "Tanger",
  "Marseille",
  "Genève",
  "Toulouse",
  "Agadir",
  "Bordeaux",
  "Lille",
  "Nantes",
  "Lausanne",
  "Remote",
];

/** Nombre de suggestions affichées : au-delà, la ligne passe sur trois rangs. */
const SUGGESTIONS_AFFICHEES = 8;

/**
 * Saisie de plusieurs villes sous forme de badges. Les valeurs partent dans le
 * FormData via des inputs cachés `localisations` répétés — le serveur les relit
 * avec getAll(), donc pas besoin de sérialisation maison.
 */
export function VillesInput({ nom = "localisations", initial = [] }: { nom?: string; initial?: string[] }) {
  const [villes, setVilles] = useState<string[]>(initial);
  const [saisie, setSaisie] = useState("");

  const plein = villes.length >= MAX_VILLES;

  function ajouter(brut: string) {
    const v = brut.trim();
    if (!v || plein) return;
    // Comparaison insensible à la casse : « lyon » et « Lyon » sont la même ville.
    if (villes.some((x) => x.toLowerCase() === v.toLowerCase())) {
      setSaisie("");
      return;
    }
    setVilles([...villes, v]);
    setSaisie("");
  }

  function retirer(v: string) {
    setVilles(villes.filter((x) => x !== v));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    // Entrée et virgule valident la ville. Entrée ne doit surtout pas
    // soumettre le formulaire entier au passage.
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      ajouter(saisie);
    } else if (e.key === "Backspace" && !saisie && villes.length > 0) {
      retirer(villes[villes.length - 1]);
    }
  }

  const restantes = SUGGESTIONS.filter(
    (s) => !villes.some((v) => v.toLowerCase() === s.toLowerCase()),
  ).slice(0, SUGGESTIONS_AFFICHEES);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] text-ink-soft">
        Villes <span className="text-ink-faint">({villes.length}/{MAX_VILLES})</span>
      </label>

      {villes.map((v) => (
        <input key={v} type="hidden" name={nom} value={v} />
      ))}

      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-line bg-card px-2 py-2 focus-within:border-accent">
        {villes.map((v) => (
          <span
            key={v}
            className="flex items-center gap-1 rounded-md bg-accent-soft px-2 py-1 text-[12px] font-medium text-accent"
          >
            {v}
            <button
              type="button"
              onClick={() => retirer(v)}
              aria-label={`Retirer ${v}`}
              className="text-accent/60 transition-colors hover:text-accent"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => ajouter(saisie)}
          disabled={plein}
          placeholder={plein ? "Maximum atteint" : villes.length ? "Ajouter…" : "Casablanca, Paris, Remote…"}
          className="min-w-[110px] flex-1 bg-transparent px-1 py-0.5 text-[14px] text-ink outline-none placeholder:text-ink-faint disabled:cursor-not-allowed"
        />
      </div>

      {restantes.length > 0 && !plein && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] text-ink-faint">Fréquentes :</span>
          {restantes.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => ajouter(s)}
              className="rounded-md border border-line bg-paper-2 px-2 py-0.5 text-[11px] text-ink-soft transition-colors hover:border-accent/40 hover:text-accent"
            >
              + {s}
            </button>
          ))}
        </div>
      )}

      <span className="text-[12px] text-ink-faint">
        Une seule recherche couvre toutes les villes. Entrée ou virgule pour valider.
      </span>
    </div>
  );
}
