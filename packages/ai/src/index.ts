import { createMistralProvider } from "./providers/mistral.js";
import { createOpenAiProvider } from "./providers/openai.js";
import { PLAFOND_PROFIL_NON_DOCUMENTE, profilDocumente } from "./types.js";
import type { ScoringInput, ScoringProvider, ScoringResult } from "./types.js";

export type {
  ScoringInput,
  ScoringProvider,
  ScoringResult,
  CritereEvalue,
  CriteresEvalues,
  CleCritere,
} from "./types.js";
export {
  CRITERES_SCORING,
  calculerScore,
  scorePlafonne,
  profilDocumente,
  PLAFOND_PROFIL_NON_DOCUMENTE,
} from "./types.js";

/**
 * Mistral is the default provider (données EU, argument RGPD), OpenAI is a
 * fallback only used if Mistral errors or MISTRAL_API_KEY is unset.
 */
function buildProviders(): ScoringProvider[] {
  const providers: ScoringProvider[] = [];
  if (process.env.MISTRAL_API_KEY) {
    providers.push(createMistralProvider(process.env.MISTRAL_API_KEY));
  }
  if (process.env.OPENAI_API_KEY) {
    providers.push(createOpenAiProvider(process.env.OPENAI_API_KEY));
  }
  if (providers.length === 0) {
    throw new Error("No scoring provider configured: set MISTRAL_API_KEY and/or OPENAI_API_KEY");
  }
  return providers;
}

export async function scoreCandidate(input: ScoringInput): Promise<ScoringResult> {
  const providers = buildProviders();
  let lastError: unknown;
  for (const provider of providers) {
    try {
      return plafonnerSiNonDocumente(await provider.score(input), input.profil);
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`All scoring providers failed. Last error: ${String(lastError)}`);
}

/**
 * Applique le plafond des profils non documentés.
 *
 * Placé ici, après le fournisseur : c'est le seul endroit qui voit à la fois
 * la note et le profil d'origine. Le mettre dans calculerScore() était
 * impossible — cette fonction ne connaît que les quatre critères, pas la
 * matière dont ils sont tirés.
 */
function plafonnerSiNonDocumente(resultat: ScoringResult, profil: unknown): ScoringResult {
  if (resultat.score === null || resultat.score <= PLAFOND_PROFIL_NON_DOCUMENTE) return resultat;
  if (profilDocumente(profil)) return resultat;
  return { ...resultat, score: PLAFOND_PROFIL_NON_DOCUMENTE, plafonneParDocumentation: true };
}
