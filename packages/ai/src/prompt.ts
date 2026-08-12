import { libelleSecteur, villesDuPoste } from "@recruitai/types";
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
  const secteur = libelleSecteur((criteres as { secteur?: string }).secteur);

  return [
    "Tu es un assistant de sourcing en recrutement, exigeant et factuel.",
    "Évalue ce candidat sur QUATRE critères indépendants, chacun noté de 0 à 100.",
    "",
    // Sans le secteur, un même intitulé recouvre des métiers sans rapport :
    // « chargé de clientèle » en banque et en télécom, « chef » en cuisine et
    // en encadrement. L'IA notait alors au hasard du sens qu'elle devinait.
    ...(secteur
      ? [
          `Ce recrutement porte sur le secteur : ${secteur}.`,
          "Un candidat dont l'expérience relève d'un autre secteur est moins",
          "pertinent, même si l'intitulé de son poste est identique. Dis-le",
          "explicitement dans le commentaire du critère « experience ».",
          "",
        ]
      : []),
    "1. competences — les compétences demandées sont-elles prouvées dans le profil ?",
    "   100 : toutes présentes avec expérience concrète · 50 : la moitié · 0 : aucune.",
    "   Une compétence non démontrable dans le profil compte comme ABSENTE.",
    // Sans cette règle, l'IA notait 0 « aucune compétence mentionnée » sur un
    // poste qui n'en exigeait aucune : elle sanctionnait le candidat pour une
    // exigence inexistante.
    (criteres.competences ?? []).length === 0
      ? "   AUCUNE compétence n'est exigée pour ce poste : renvoie note = null.\n" +
        "   Ne reproche pas au candidat de ne rien démontrer — rien n'est demandé."
      : `   Compétences exigées : ${criteres.competences.join(", ")}.`,
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
    "   Si le profil ne contient AUCUNE information de localisation, renvoie",
    "   note = null. Ne devine pas et ne pénalise pas : selon la source, la",
    "   ville peut simplement ne pas avoir été collectée.",
    "",
    "Règles impératives :",
    "- Sois discriminant. Deux profils ne méritent la même note que s'ils se valent.",
    "- Chaque commentaire tient en UNE phrase courte et factuelle, citant le profil.",
    "- N'invente jamais une information absente du profil.",
    "- note = null dans DEUX cas seulement : le critère est sans objet pour ce",
    "  poste, ou le profil ne contient rien qui permette de l'évaluer. Un",
    "  candidat mauvais reçoit une note basse, jamais null.",
    "- Les profils viennent de sources différentes, plus ou moins complètes.",
    "  Un champ absent n'est pas un défaut du candidat : ne l'en pénalise pas.",
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
