import type { ScoringInput } from "./types.js";

export function buildScoringPrompt({ criteres, profil }: ScoringInput): string {
  return [
    "Tu es un assistant de sourcing recrutement exigeant. Note ce profil candidat",
    "par rapport aux critères du poste, sur une échelle 0-100.",
    "",
    "Barème (à respecter strictement pour permettre un classement utile) :",
    "- 90-100 : correspondance quasi parfaite, tous les critères clés couverts avec de l'expérience réelle.",
    "- 70-89 : bon profil, la plupart des critères couverts, quelques manques.",
    "- 50-69 : profil correct mais plusieurs critères clés absents ou incertains.",
    "- 20-49 : correspondance faible, l'essentiel des critères manque.",
    "- 0-19 : hors sujet.",
    "",
    "Règles :",
    "- Sois discriminant : n'attribue 90+ que si le profil se démarque vraiment. Deux profils",
    "  ne devraient avoir le même score que s'ils se valent réellement.",
    "- Une compétence/critère non prouvable dans le profil compte comme absent, pas comme acquis.",
    "- Séniorité et localisation demandées comptent dans la note.",
    "",
    "Réponds UNIQUEMENT avec un objet JSON :",
    '{"score": <entier 0-100>, "justification": "<une phrase précise citant les critères remplis/manquants>"}',
    "",
    `Critères du poste: ${JSON.stringify(criteres)}`,
    `Profil candidat: ${JSON.stringify(profil)}`,
  ].join("\n");
}
