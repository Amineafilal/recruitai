import { ReponseIaSchema, calculerScore, type ScoringResult } from "./types.js";

/**
 * Transforme la réponse brute d'un fournisseur en résultat de scoring.
 *
 * Partagé par tous les fournisseurs : le calcul du score doit être identique
 * quel que soit le moteur, sinon un candidat noté par Mistral et un autre par
 * OpenAI ne seraient pas comparables dans la même shortlist.
 */
export function parserReponseIa(contenu: string): ScoringResult {
  const parsed = ReponseIaSchema.parse(JSON.parse(contenu));
  return {
    score: calculerScore(parsed.criteres),
    justification: parsed.synthese,
    criteres: parsed.criteres,
  };
}
