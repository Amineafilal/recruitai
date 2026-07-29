import { z } from "zod";

export const ScrapeSource = z.enum(["linkedin", "indeed", "apec", "wttj"]);
export type ScrapeSource = z.infer<typeof ScrapeSource>;

export const ScrapeStatus = z.enum(["pending", "ingested", "normalized", "failed"]);
export type ScrapeStatus = z.infer<typeof ScrapeStatus>;

export const RawScrapeResultSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  source: ScrapeSource,
  apifyRunId: z.string(),
  payload: z.unknown(),
  fetchedAt: z.coerce.date(),
  statut: ScrapeStatus,
});
export type RawScrapeResult = z.infer<typeof RawScrapeResultSchema>;
