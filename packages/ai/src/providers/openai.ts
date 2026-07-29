import { buildScoringPrompt } from "../prompt.js";
import { ScoringResultSchema, type ScoringInput, type ScoringProvider, type ScoringResult } from "../types.js";

export function createOpenAiProvider(apiKey: string): ScoringProvider {
  return {
    name: "openai",
    async score(input: ScoringInput): Promise<ScoringResult> {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: buildScoringPrompt(input) }],
          response_format: { type: "json_object" },
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI scoring failed: ${response.status} ${await response.text()}`);
      }

      const body = (await response.json()) as { choices: { message: { content: string } }[] };
      const content = body.choices[0]?.message.content;
      if (!content) {
        throw new Error("OpenAI scoring returned no content");
      }
      return ScoringResultSchema.parse(JSON.parse(content));
    },
  };
}
