import { z } from "zod";
import type { JobCriteria } from "@recruitai/types";

export interface ScoringInput {
  criteres: JobCriteria;
  profil: unknown;
}

export const ScoringResultSchema = z.object({
  score: z.number().min(0).max(100),
  justification: z.string(),
});
export type ScoringResult = z.infer<typeof ScoringResultSchema>;

export interface ScoringProvider {
  name: string;
  score(input: ScoringInput): Promise<ScoringResult>;
}
