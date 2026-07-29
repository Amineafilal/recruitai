import type { Job } from "bullmq";
import { eq } from "drizzle-orm";
import { getAdminDb, schema } from "@recruitai/db";
import type { ScrapeSource } from "@recruitai/types";
import { sourcingScrapeQueue, cvthequeEnrichQueue, outreachSendQueue } from "../queues.js";

const ALL_SOURCES: ScrapeSource[] = ["linkedin", "indeed", "apec", "wttj"];

/**
 * Ne planifie que les sources dont l'actor Apify est configuré en env
 * (APIFY_<SOURCE>_ACTOR_ID). Évite d'enfiler des jobs voués à l'échec pour
 * les sources pas encore câblées.
 */
function activeSources(): ScrapeSource[] {
  return ALL_SOURCES.filter((s) => Boolean(process.env[`APIFY_${s.toUpperCase()}_ACTOR_ID`]));
}

/**
 * Ces deux fonctions énumèrent across-tenant (tous les postes ouverts, tous
 * les tenants) — c'est le seul endroit du code qui a besoin de lire au-delà
 * d'un tenant. Ça exige que le rôle Postgres derrière DATABASE_URL pour le
 * worker ait BYPASSRLS (`alter role ... bypassrls;`), sans quoi ces requêtes
 * ne renverront silencieusement aucune ligne. Le reste du code applicatif
 * (processors, api) ne doit jamais utiliser adminDb pour du data tenant —
 * seulement withTenant().
 */
async function scheduleDailySourcing(): Promise<void> {
  const sources = activeSources();
  if (sources.length === 0) return;
  const openJobs = await getAdminDb().select().from(schema.jobs).where(eq(schema.jobs.statut, "ouvert"));
  for (const openJob of openJobs) {
    for (const source of sources) {
      await sourcingScrapeQueue.add("scrape", { tenantId: openJob.tenantId, jobId: openJob.id, source });
    }
  }
}

async function scheduleNightlyCvtheque(): Promise<void> {
  const tenants = await getAdminDb().select().from(schema.tenants);
  for (const tenant of tenants) {
    await cvthequeEnrichQueue.add("enrich", { tenantId: tenant.id });
  }
}

/**
 * Les relances partent en journée (et pas la nuit comme l'enrichissement) :
 * un email de recrutement reçu à 3h du matin fait fuir le candidat et abîme
 * la réputation d'envoi du domaine.
 */
async function scheduleOutreach(): Promise<void> {
  const campagnes = await getAdminDb().select().from(schema.campaigns).where(eq(schema.campaigns.statut, "actif"));
  for (const campagne of campagnes) {
    await outreachSendQueue.add("send", { tenantId: campagne.tenantId, campaignId: campagne.id });
  }
}

export async function processScheduler(job: Job<{ kind: "daily" | "nightly" | "outreach" }>): Promise<void> {
  if (job.data.kind === "daily") {
    await scheduleDailySourcing();
  } else if (job.data.kind === "outreach") {
    await scheduleOutreach();
  } else {
    await scheduleNightlyCvtheque();
  }
}
