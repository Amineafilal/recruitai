// DOIT rester le tout premier import : charge .env avant que redis.ts /
// queues.ts ne lisent process.env à leur évaluation (ordre ESM).
import "./env.js";
import { Worker } from "bullmq";
import { connection } from "./redis.js";
import { QUEUE_NAMES, schedulerQueue, rgpdPurgeQueue } from "./queues.js";
import { processSourcingScrape } from "./processors/sourcing-scrape.js";
import { processSourcingNormalize } from "./processors/sourcing-normalize.js";
import { processCvthequeEnrich } from "./processors/cvtheque-enrich.js";
import { processOutreachSend } from "./processors/outreach-send.js";
import { processRgpdPurge } from "./processors/rgpd-purge.js";
import { processScheduler } from "./processors/scheduler.js";

const workers = [
  new Worker(QUEUE_NAMES.sourcingScrape, processSourcingScrape, { connection, concurrency: 5 }),
  new Worker(QUEUE_NAMES.sourcingNormalize, processSourcingNormalize, { connection, concurrency: 5 }),
  new Worker(QUEUE_NAMES.cvthequeEnrich, processCvthequeEnrich, { connection, concurrency: 2 }),
  // Concurrence 1 : les envois d'une campagne partent en série pour rester
  // sous les limites de débit Resend et préserver la réputation du domaine.
  new Worker(QUEUE_NAMES.outreachSend, processOutreachSend, { connection, concurrency: 1 }),
  new Worker(QUEUE_NAMES.rgpdPurge, processRgpdPurge, { connection, concurrency: 1 }),
  new Worker(QUEUE_NAMES.scheduler, processScheduler, { connection, concurrency: 1 }),
];

for (const worker of workers) {
  worker.on("failed", (job, err) => {
    console.error(`[${worker.name}] job ${job?.id} failed:`, err);
  });
}

async function registerRepeatableSchedules(): Promise<void> {
  await schedulerQueue.add(
    "daily-sourcing",
    { kind: "daily" },
    { repeat: { pattern: "0 6 * * *" }, jobId: "daily-sourcing" }, // 06:00 chaque jour
  );
  await schedulerQueue.add(
    "nightly-cvtheque",
    { kind: "nightly" },
    { repeat: { pattern: "0 2 * * *" }, jobId: "nightly-cvtheque" }, // 02:00 chaque nuit
  );
  await schedulerQueue.add(
    "outreach",
    { kind: "outreach" },
    // 09:00 en semaine seulement : pas de relance le week-end ni la nuit.
    { repeat: { pattern: "0 9 * * 1-5" }, jobId: "outreach" },
  );
  await rgpdPurgeQueue.add(
    "purge",
    {},
    // Purge de rétention chaque dimanche à 03:00, hors heures d'activité.
    { repeat: { pattern: "0 3 * * 0" }, jobId: "rgpd-purge" },
  );
}

registerRepeatableSchedules()
  .then(() => console.log("RecruitAI worker started, repeatable schedules registered."))
  .catch((err) => {
    console.error("Failed to register repeatable schedules:", err);
    process.exit(1);
  });

async function shutdown(): Promise<void> {
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
