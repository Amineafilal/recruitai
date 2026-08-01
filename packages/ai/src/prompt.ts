import { villesDuPoste } from "@recruitai/types";
import type { ScoringInput } from "./types.js";

/**
 * Consigne de notation, critère par critère.
 *
 * L'IA ne donne PAS de note globale : elle évalue chaque critère
 * indépendamment, et le total est calculé par calculerScore(). Sans cette
 * séparation, le modèle produirait un chiffre cohérent avec sa propre
 * intuition mais pas avec le détail affiché — et un recruteur qui voit un
 * total ne correspondant pas à ses composantes cesse de croire à l'outil.
 */
export function buildScoringPrompt({ criteres, profil }: ScoringInput): string {
  const villes = villesDuPoste(criteres);

  return [
    "Tu es un assistant de sourcing en recrutement, exigeant et factuel.",
    "Évalue ce candidat sur QUATRE critères indépendants, chacun noté de 0 à 100.",
    "",
    "1. competences — les compétences demandées sont-elles prouvées dans le profil ?",
    "   100 : toutes présentes avec expérience concrète · 50 : la moitié · 0 : aucune.",
    "   Une compétence non démontrable dans le profil compte comme ABSENTE.",
    "",
    "2. experience — l'expérience est-elle pertinente pour ce poste précis ?",
    "   Juge la nature des postes occupés, pas seulement le nombre d'années :",
    "   dix ans dans un autre métier ne valent pas deux ans dans le bon.",
    "",
    "3. seniorite — le niveau correspond-il à ce qui est demandé ?",
    "   100 : correspond exactement · 50 : un cran d'écart · 0 : deux crans ou plus.",
    "   Un profil SURqualifié n'est pas idéal — il partira. Note-le autour de 60.",
    "",
    "4. localisation — le candidat est-il dans une des villes visées ?",
    "   100 : dans l'une d'elles · 60 : même région · 20 : autre pays.",
    villes.length === 0
      ? "   AUCUNE ville n'est demandée ici : renvoie note = null pour ce critère."
      : `   Villes visées : ${villes.join(", ")}.`,
    "",
    "Règles impératives :",
    "- Sois discriminant. Deux profils ne méritent la même note que s'ils se valent.",
    "- Chaque commentaire tient en UNE phrase courte et factuelle, citant le profil.",
    "- N'invente jamais une information absente du profil.",
    "- note = null UNIQUEMENT si le critère est inapplicable, jamais parce que le",
    "  candidat est mauvais : dans ce cas la note est basse, pas nulle.",
    "",
    "Réponds UNIQUEMENT avec cet objet JSON :",
    "{",
    '  "criteres": {',
    '    "competences":  {"note": <0-100|null>, "commentaire": "<une phrase>"},',
    '    "experience":   {"note": <0-100|null>, "commentaire": "<une phrase>"},',
    '    "seniorite":    {"note": <0-100|null>, "commentaire": "<une phrase>"},',
    '    "localisation": {"note": <0-100|null>, "commentaire": "<une phrase>"}',
    "  },",
    '  "synthese": "<une à deux phrases : la valeur du profil et ce qui lui manque>"',
    "}",
    "",
    `Critères du poste : ${JSON.stringify({ ...criteres, localisations: villes })}`,
    `Profil du candidat : ${JSON.stringify(profil)}`,
  ].join("\n");
}
