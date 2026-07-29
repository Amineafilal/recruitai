import { Queue } from "bullmq";
import { connection } from "./redis.js";

// Pas de ":" dans les noms de queues : BullMQ l'utilise comme séparateur de
// clés Redis et refuse le caractère à la construction.
export const QUEUE_NAMES = {
  sourcingScrape: "sourcing-scrape",
  sourcingNormalize: "sourcing-normalize",
  cvthequeEnrich: "cvtheque-enrich",
  outreachSend: "outreach-send",
  rgpdPurge: "rgpd-purge",
  scheduler: "scheduler",
} as const;

export const sourcingScrapeQueue = new Queue(QUEUE_NAMES.sourcingScrape, { connection });
export const sourcingNormalizeQueue = new Queue(QUEUE_NAMES.sourcingNormalize, { connection });
export const cvthequeEnrichQueue = new Queue(QUEUE_NAMES.cvthequeEnrich, { connection });
export const outreachSendQueue = new Queue(QUEUE_NAMES.outreachSend, { connection });
export const rgpdPurgeQueue = new Queue(QUEUE_NAMES.rgpdPurge, { connection });
export const schedulerQueue = new Queue(QUEUE_NAMES.scheduler, { connection });

export interface SourcingScrapeJobData {
  tenantId: string;
  jobId: string;
  source: "linkedin" | "indeed" | "apec" | "wttj";
}

export interface SourcingNormalizeJobData {
  tenantId: string;
  jobId: string;
  rawScrapeResultId: string;
}

export interface CvthequeEnrichJobData {
  tenantId: string;
}

export interface OutreachSendJobData {
  tenantId: string;
  campaignId: string;
}
