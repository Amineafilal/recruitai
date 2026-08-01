import { createMistralProvider } from "./providers/mistral.js";
import { createOpenAiProvider } from "./providers/openai.js";
import type { ScoringInput, ScoringProvider, ScoringResult } from "./types.js";

export type {
  ScoringInput,
  ScoringProvider,
  ScoringResult,
  CritereEvalue,
  CriteresEvalues,
  CleCritere,
} from "./types.js";
export { CRITERES_SCORING, calculerScore, scorePlafonne } from "./types.js";

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
      return await provider.score(input);
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`All scoring providers failed. Last error: ${String(lastError)}`);
}
