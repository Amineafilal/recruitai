import { eq, and, sql } from "drizzle-orm";
import { withTenant, schema } from "@recruitai/db";
import { PLAN_CONFIGS } from "@recruitai/types";

/**
 * Budget mensuel de scraping par agence.
 *
 * Sans ce plafond, un enrichissement sur une CVthèque de 12 000 profils
 * partirait en une nuit et consommerait des crédits Apify réels. Le compteur
 * est mensuel et remis à zéro par le changement de mois (une nouvelle ligne
 * est créée), jamais par une tâche de nettoyage.
 */

function moisCourant(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function ligneUsage(tenantId: string) {
  return withTenant(tenantId, async (tx) => {
    const mois = moisCourant();
    const [existante] = await tx
      .select()
      .from(schema.tenantScrapeUsage)
      .where(and(eq(schema.tenantScrapeUsage.tenantId, tenantId), eq(schema.tenantScrapeUsage.mois, mois)));
    if (existante) return existante;

    const [tenant] = await tx.select().from(schema.tenants).where(eq(schema.tenants.id, tenantId));
    if (!tenant) return null;

    // Le plafond du plan peut être abaissé globalement par variable d'env :
    // utile pour rester sous le quota gratuit du fournisseur en début de vie.
    const plafondPlan = PLAN_CONFIGS[tenant.plan].monthlyScrapeCreditsCap;
    const plafondGlobal = Number(process.env.SCRAPE_CREDITS_CAP ?? plafondPlan);

    const [creee] = await tx
      .insert(schema.tenantScrapeUsage)
      .values({
        tenantId,
        mois,
        creditsUtilises: 0,
        creditsPlafond: Math.min(plafondPlan, plafondGlobal),
      })
      .onConflictDoNothing()
      .returning();

    return creee ?? existante ?? null;
  });
}

/** Crédits encore disponibles ce mois-ci pour cette agence. */
export async function budgetRestant(tenantId: string): Promise<number> {
  const usage = await ligneUsage(tenantId);
  if (!usage) return 0;
  return Math.max(0, usage.creditsPlafond - usage.creditsUtilises);
}

export async function enregistrerUsage(tenantId: string, credits: number): Promise<void> {
  if (credits <= 0) return;
  await ligneUsage(tenantId);
  const mois = moisCourant();
  await withTenant(tenantId, async (tx) => {
    await tx
      .update(schema.tenantScrapeUsage)
      .set({ creditsUtilises: sql`${schema.tenantScrapeUsage.creditsUtilises} + ${credits}` })
      .where(and(eq(schema.tenantScrapeUsage.tenantId, tenantId), eq(schema.tenantScrapeUsage.mois, mois)));
  });
}
