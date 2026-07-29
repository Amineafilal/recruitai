import type { Job } from "bullmq";
import { eq } from "drizzle-orm";
import { withTenant, schema } from "@recruitai/db";
import { villesDuPoste, type JobCriteria } from "@recruitai/types";
import { runActorAndCollect } from "../apify-client.js";
import { actorIdFor } from "../actor-registry.js";
import { hasRemainingBudget, recordUsage } from "../scrape-budget.js";
import { sourcingNormalizeQueue, type SourcingScrapeJobData } from "../queues.js";

export async function processSourcingScrape(job: Job<SourcingScrapeJobData>): Promise<void> {
  const { tenantId, jobId, source } = job.data;

  if (!(await hasRemainingBudget(tenantId))) {
    job.log(`Quota de scraping atteint pour le tenant ${tenantId}, poste ${jobId} reporté au prochain cycle.`);
    return;
  }

  const criteres = await withTenant(tenantId, async (tx) => {
    const [row] = await tx.select().from(schema.jobs).where(eq(schema.jobs.id, jobId));
    if (!row) throw new Error(`Job ${jobId} not found for tenant ${tenantId}`);
    return row.criteres as JobCriteria;
  });

  const actorId = actorIdFor(source);
  const { runId, items } = await runActorAndCollect(actorId, buildActorInput(source, criteres));

  await recordUsage(tenantId, items.length || 1);

  const rawResultId = await withTenant(tenantId, async (tx) => {
    const [inserted] = await tx
      .insert(schema.rawScrapeResults)
      .values({
        tenantId,
        source,
        apifyRunId: runId,
        payload: items,
        statut: "ingested",
      })
      .returning({ id: schema.rawScrapeResults.id });
    return inserted.id;
  });

  await sourcingNormalizeQueue.add("normalize", { tenantId, jobId, rawScrapeResultId: rawResultId });
}

// Nombre max de profils ramenés par recherche (par poste × source). En mode
// "Short", 1 page = 0,10 $ jusqu'à 25 profils — au-delà on paie une page de
// plus. On plafonne à 25 par défaut pour rester à une page.
const MAX_PROFILES = Number(process.env.APIFY_MAX_PROFILES_PER_SEARCH ?? 25);

/**
 * Traduit les critères d'un poste vers le schéma d'entrée de l'actor Apify
 * correspondant à la source. Chaque actor a son propre schéma : on branche
 * explicitement par source, et on refuse les sources non encore câblées
 * plutôt que d'envoyer un input générique qui échouerait silencieusement.
 */
function buildActorInput(source: string, criteres: JobCriteria): Record<string, unknown> {
  switch (source) {
    case "linkedin":
      // Schéma harvestapi/linkedin-profile-search.
      return {
        // Recherche floue : intitulé + compétences.
        searchQuery: [criteres.titre, ...criteres.competences].join(" ").trim(),
        currentJobTitles: [criteres.titre],
        ...(villesDuPoste(criteres).length > 0 ? { locations: villesDuPoste(criteres) } : {}),
        // "Short" : nom, titre, URL, localisation — suffisant pour le scoring,
        // le moins cher. "Full" ajoute l'expérience détaillée à 0,004 $/profil.
        profileScraperMode: process.env.APIFY_LINKEDIN_MODE ?? "Short",
        maxItems: MAX_PROFILES,
      };
    default:
      throw new Error(
        `Aucun schéma d'input Apify configuré pour la source "${source}". ` +
          `Câbler l'actor et son mapping dans buildActorInput avant de l'activer.`,
      );
  }
}
