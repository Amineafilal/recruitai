import "./env.js";
import { Queue, Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { getAdminDb, withTenant, schema } from "@recruitai/db";
import { connection } from "./redis.js";
import { processRgpdPurge } from "./processors/rgpd-purge.js";

// Prouve que le pipeline worker complet fonctionne : un job enfilé traverse
// BullMQ (Redis réel), est traité par le processor, et produit l'effet
// attendu en base + audit_log. Consomme un peu de quota Upstash (à lancer à
// la demande, pas en boucle).
const QUEUE = "rgpd-purge";
const db = getAdminDb();
let echecs = 0;
const verifie = (label: string, ok: boolean) => {
  console.log(`${ok ? "  OK  " : " ECHEC"} ${label}`);
  if (!ok) echecs++;
};

async function main() {
  const [tenant] = await db
    .insert(schema.tenants)
    .values({ nom: "Agence Purge E2E", plan: "starter", clerkOrgId: `purge_${Date.now()}` })
    .returning();
  const tenantId = tenant.id;

  const vieux = new Date();
  vieux.setMonth(vieux.getMonth() - 30);
  await withTenant(tenantId, (tx) =>
    tx.insert(schema.cvthequeProfiles).values({
      tenantId,
      dedupeKey: "email:obsolete@example.com",
      contact: { email: "obsolete@example.com", prenom: "Vieux" },
      createdAt: vieux,
    }),
  );

  const queue = new Queue(QUEUE, { connection });
  const worker = new Worker(QUEUE, processRgpdPurge, { connection, concurrency: 1 });

  try {
    const done = new Promise<void>((resolve, reject) => {
      worker.on("completed", () => resolve());
      worker.on("failed", (_job, err) => reject(err));
      setTimeout(() => reject(new Error("timeout : job non traité en 30s")), 30000);
    });

    console.log("Job rgpd-purge enfilé, attente du traitement par le worker...");
    await queue.add("purge", { tenantId });
    await done;
    console.log("Job traité.\n");

    const restants = await withTenant(tenantId, (tx) =>
      tx.select().from(schema.cvthequeProfiles).where(eq(schema.cvthequeProfiles.tenantId, tenantId)),
    );
    verifie("profil obsolète supprimé", restants.length === 0);

    const audit = await withTenant(tenantId, (tx) =>
      tx.select().from(schema.auditLog).where(eq(schema.auditLog.tenantId, tenantId)),
    );
    verifie("entrée audit_log écrite", audit.some((a) => a.action.startsWith("purge_rgpd")));
    verifie("acteur = worker:rgpd-purge", audit.some((a) => a.acteur === "worker:rgpd-purge"));
  } finally {
    await worker.close();
    await queue.obliterate({ force: true });
    await queue.close();
    await db.delete(schema.tenants).where(eq(schema.tenants.id, tenantId));
    connection.disconnect();
  }

  if (echecs > 0) {
    console.error(`\n${echecs} échec(s).`);
    process.exit(1);
  }
  console.log("\nPipeline worker (enqueue -> processor -> base -> audit) vérifié.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
