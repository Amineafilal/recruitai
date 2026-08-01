import { buildScoringPrompt } from "../prompt.js";
import { parserReponseIa } from "../parse-reponse.js";
import type { ScoringInput, ScoringProvider, ScoringResult } from "../types.js";

export function createMistralProvider(apiKey: string): ScoringProvider {
  return {
    name: "mistral",
    async score(input: ScoringInput): Promise<ScoringResult> {
      const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "mistral-small-latest",
          messages: [{ role: "user", content: buildScoringPrompt(input) }],
          response_format: { type: "json_object" },
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        throw new Error(`Mistral scoring failed: ${response.status} ${await response.text()}`);
      }

      const body = (await response.json()) as { choices: { message: { content: string } }[] };
      const content = body.choices[0]?.message.content;
      if (!content) {
        throw new Error("Mistral scoring returned no content");
      }
      return parserReponseIa(content);
    },
  };
}
