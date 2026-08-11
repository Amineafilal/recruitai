import type { Job } from "bullmq";
import { eq } from "drizzle-orm";
import { withTenant, schema } from "@recruitai/db";
import type { JobCriteria } from "@recruitai/types";
import { scoreCandidate } from "@recruitai/ai";
import type { SourcingNormalizeJobData } from "../queues.js";

export async function processSourcingNormalize(job: Job<SourcingNormalizeJobData>): Promise<void> {
  const { tenantId, jobId, rawScrapeResultId } = job.data;

  // 1) Lecture courte : on récupère le lot brut et les critères, puis on ferme
  //    la transaction immédiatement.
  const contexte = await withTenant(tenantId, async (tx) => {
    const [raw] = await tx
      .select()
      .from(schema.rawScrapeResults)
      .where(eq(schema.rawScrapeResults.id, rawScrapeResultId));
    if (!raw) throw new Error(`raw_scrape_results ${rawScrapeResultId} not found`);

    const [jobRow] = await tx.select().from(schema.jobs).where(eq(schema.jobs.id, jobId));
    if (!jobRow) throw new Error(`Job ${jobId} not found for tenant ${tenantId}`);

    return {
      source: raw.source,
      criteres: jobRow.criteres as JobCriteria,
      items: (raw.payload as unknown[]) ?? [],
    };
  });

  // 2) Scoring HORS transaction : chaque appel Mistral prend 1-3s, on ne veut
  //    surtout pas garder une connexion Postgres du pooler ouverte pendant
  //    ces I/O réseau séquentielles (risque de timeout idle-in-transaction).
  // score null : l'IA a répondu mais le profil ne contenait rien d'évaluable.
  // Enregistré sans note et signalé, jamais converti en 0 — ce qui reviendrait
  // à faire passer pour mauvais un candidat qui n'a pas été jugé.
  const scored: { profil: unknown; score: number | null; statut: "ok" | "non_evaluable" }[] = [];
  for (const profil of contexte.items) {
    try {
      const result = await scoreCandidate({ criteres: contexte.criteres, profil });
      scored.push({
        profil,
        score: result.score,
        statut: result.score === null ? "non_evaluable" : "ok",
      });
    } catch (err) {
      job.log(`Scoring échoué pour un profil, ignoré : ${String(err)}`);
    }
  }

  // 3) Écriture : transaction courte, uniquement des inserts + le passage du
  //    lot brut en "normalized".
  await withTenant(tenantId, async (tx) => {
    if (scored.length > 0) {
      await tx.insert(schema.sourcingCandidates).values(
        scored.map(({ profil, score, statut }) => ({
          tenantId,
          jobId,
          source: contexte.source,
          score,
          statutScoring: statut,
          scoringErreur:
            statut === "non_evaluable"
              ? "Profil trop incomplet pour être noté : la source n'a renvoyé aucune donnée exploitable."
              : null,
          profil,
          statutValidation: "a_valider" as const,
        })),
      );
    }
    await tx
      .update(schema.rawScrapeResults)
      .set({ statut: "normalized" })
      .where(eq(schema.rawScrapeResults.id, rawScrapeResultId));
  });
}
