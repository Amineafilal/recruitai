import "./env.js";
import { Queue, Worker } from "bullmq";
import { eq, desc } from "drizzle-orm";
import { getAdminDb, withTenant, schema } from "@recruitai/db";
import { connection } from "./redis.js";
import { processSourcingScrape } from "./processors/sourcing-scrape.js";
import { processSourcingNormalize } from "./processors/sourcing-normalize.js";

// ATTENTION : ce test dépense des crédits Apify réels (~0,10 $ pour une page)
// + quelques appels Mistral. Lancer avec APIFY_MAX_PROFILES_PER_SEARCH=3 pour
// minimiser le coût :
//   APIFY_MAX_PROFILES_PER_SEARCH=3 npm run --workspace=@recruitai/worker test:sourcing
const db = getAdminDb();
let echecs = 0;
const verifie = (label: string, ok: boolean) => {
  console.log(`${ok ? "  OK  " : " ECHEC"} ${label}`);
  if (!ok) echecs++;
};

function nomEtTitre(p: Record<string, unknown>): string {
  const nom = [p.firstName, p.lastName].filter(Boolean).join(" ") || "(nom ?)";
  const positions = p.currentPositions as { title?: string; companyName?: string }[] | undefined;
  const poste = positions?.[0]?.title ?? "";
  return `${nom} — ${poste}`.slice(0, 70);
}

async function main() {
  const [tenant] = await db
    .insert(schema.tenants)
    .values({ nom: "Agence Sourcing E2E", plan: "growth", clerkOrgId: `sourcing_${Date.now()}` })
    .returning();
  const tenantId = tenant.id;

  const [poste] = await withTenant(tenantId, (tx) =>
    tx
      .insert(schema.jobs)
      .values({
        tenantId,
        statut: "ouvert",
        criteres: {
          titre: "Développeur React",
          competences: ["React", "TypeScript"],
          localisation: "Lyon",
          seniorite: "confirme",
        },
      })
      .returning(),
  );

  const scrapeQ = new Queue("sourcing-scrape", { connection });
  const scrapeW = new Worker("sourcing-scrape", processSourcingScrape, { connection, concurrency: 1 });
  const normalizeW = new Worker("sourcing-normalize", processSourcingNormalize, { connection, concurrency: 1 });

  try {
    const chaineTerminee = new Promise<void>((resolve, reject) => {
      normalizeW.on("completed", () => resolve());
      normalizeW.on("failed", (_j, err) => reject(new Error("normalize: " + err.message)));
      scrapeW.on("failed", (_j, err) => reject(new Error("scrape: " + err.message)));
      setTimeout(() => reject(new Error("timeout : chaîne non terminée en 5min")), 300000);
    });

    console.log("Job sourcing-scrape enfilé (LinkedIn, Développeur React / Lyon)...");
    console.log("Scraping Apify en cours (peut prendre 1-2 min)...");
    await scrapeQ.add("scrape", { tenantId, jobId: poste.id, source: "linkedin" });
    await chaineTerminee;
    console.log("Chaîne terminée.\n");

    const raw = await withTenant(tenantId, (tx) =>
      tx.select().from(schema.rawScrapeResults).where(eq(schema.rawScrapeResults.tenantId, tenantId)),
    );
    verifie("lot brut enregistré", raw.length === 1);
    verifie("lot marqué normalized", raw[0]?.statut === "normalized");

    const candidats = await withTenant(tenantId, (tx) =>
      tx
        .select()
        .from(schema.sourcingCandidates)
        .where(eq(schema.sourcingCandidates.tenantId, tenantId))
        .orderBy(desc(schema.sourcingCandidates.score)),
    );
    verifie("candidats scorés insérés", candidats.length > 0);
    // Un score null est légitime : le scoring a échoué et le candidat est
    // conservé sans note plutôt que d'être écarté silencieusement.
    verifie(
      "scores dans [0,100] ou non notés",
      candidats.every((c) => c.score === null || (c.score >= 0 && c.score <= 100)),
    );
    verifie("statut à_valider", candidats.every((c) => c.statutValidation === "a_valider"));

    console.log("\n   Shortlist (top 5 par score) :");
    for (const c of candidats.slice(0, 5)) {
      console.log(`     [${c.score}] ${nomEtTitre(c.profil as Record<string, unknown>)}`);
    }
  } finally {
    await scrapeW.close();
    await normalizeW.close();
    await scrapeQ.obliterate({ force: true }).catch(() => {});
    await scrapeQ.close();
    await db.delete(schema.tenants).where(eq(schema.tenants.id, tenantId));
    connection.disconnect();
  }

  if (echecs > 0) {
    console.error(`\n${echecs} échec(s).`);
    process.exit(1);
  }
  console.log("\nChaîne sourcing (scrape Apify -> scoring Mistral -> shortlist) vérifiée.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
