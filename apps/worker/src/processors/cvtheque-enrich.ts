import type { Job } from "bullmq";
import { and, asc, eq, isNull, or, lt } from "drizzle-orm";
import { withTenant, schema } from "@recruitai/db";
import { runActorAndCollect } from "../apify-client.js";
import { actorIdFor } from "../actor-registry.js";
import { hasRemainingBudget, remainingBudget, recordUsage } from "../scrape-budget.js";
import type { CvthequeEnrichJobData } from "../queues.js";

const BATCH_SIZE = 200;
const STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

/** Forme minimale attendue dans cvtheque_profiles.contact — pas de validation
 * stricte au niveau DB (jsonb libre), documentée ici pour le code qui la lit. */
interface CvthequeContact {
  linkedinUrl?: string;
  poste?: string;
  diplome?: string;
  [key: string]: unknown;
}

export async function processCvthequeEnrich(job: Job<CvthequeEnrichJobData>): Promise<void> {
  const { tenantId } = job.data;

  const budget = await remainingBudget(tenantId);
  if (budget <= 0) {
    job.log(`Quota d'enrichissement CVthèque atteint pour le tenant ${tenantId} ce mois-ci.`);
    return;
  }

  const limit = Math.min(BATCH_SIZE, budget);
  const staleThreshold = new Date(Date.now() - STALE_AFTER_MS);

  const candidates = await withTenant(tenantId, async (tx) =>
    tx
      .select()
      .from(schema.cvthequeProfiles)
      .where(
        and(
          eq(schema.cvthequeProfiles.tenantId, tenantId),
          or(
            isNull(schema.cvthequeProfiles.dernierEnrichissementAt),
            lt(schema.cvthequeProfiles.dernierEnrichissementAt, staleThreshold),
          ),
        ),
      )
      .orderBy(asc(schema.cvthequeProfiles.dernierEnrichissementAt))
      .limit(limit),
  );

  const withUrl = candidates.filter((c) => (c.contact as CvthequeContact)?.linkedinUrl);
  if (withUrl.length === 0) return;

  const actorId = actorIdFor("linkedin");
  const urls = withUrl.map((c) => (c.contact as CvthequeContact).linkedinUrl);
  const { runId, items } = await runActorAndCollect<CvthequeContact & { linkedinUrl: string }>(actorId, {
    profileUrls: urls,
  });

  await recordUsage(tenantId, items.length || withUrl.length);

  await withTenant(tenantId, async (tx) => {
    await tx.insert(schema.rawScrapeResults).values({
      tenantId,
      source: "linkedin",
      apifyRunId: runId,
      payload: items,
      statut: "ingested",
    });

    const byUrl = new Map(items.map((item) => [item.linkedinUrl, item]));

    for (const profile of withUrl) {
      const before = profile.contact as CvthequeContact;
      const fresh = byUrl.get(before.linkedinUrl!);
      if (!fresh) continue;

      const changed = before.poste !== fresh.poste || before.diplome !== fresh.diplome;

      await tx
        .update(schema.cvthequeProfiles)
        .set({
          contact: { ...before, ...fresh },
          dernierEnrichissementAt: new Date(),
          statutChaud: changed ? true : profile.statutChaud,
        })
        .where(eq(schema.cvthequeProfiles.id, profile.id));

      if (changed) {
        await tx.insert(schema.signals).values({
          tenantId,
          profileId: profile.id,
          type: before.poste !== fresh.poste ? "changement_poste" : "nouveau_diplome",
        });
      }
    }
  });
}
