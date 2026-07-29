import { eq, and, sql } from "drizzle-orm";
import { withTenant, schema } from "@recruitai/db";
import { PLAN_CONFIGS } from "@recruitai/types";

function currentMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function ensureUsageRow(tenantId: string) {
  return withTenant(tenantId, async (tx) => {
    const mois = currentMonth();
    const [existing] = await tx
      .select()
      .from(schema.tenantScrapeUsage)
      .where(and(eq(schema.tenantScrapeUsage.tenantId, tenantId), eq(schema.tenantScrapeUsage.mois, mois)));
    if (existing) return existing;

    const [tenant] = await tx.select().from(schema.tenants).where(eq(schema.tenants.id, tenantId));
    if (!tenant) throw new Error(`Tenant ${tenantId} not found`);

    const [created] = await tx
      .insert(schema.tenantScrapeUsage)
      .values({
        tenantId,
        mois,
        creditsUtilises: 0,
        creditsPlafond: PLAN_CONFIGS[tenant.plan].monthlyScrapeCreditsCap,
      })
      .onConflictDoNothing()
      .returning();

    return created ?? existing;
  });
}

/** True si le tenant a encore du budget de scraping ce mois-ci. */
export async function hasRemainingBudget(tenantId: string, requiredCredits = 1): Promise<boolean> {
  const usage = await ensureUsageRow(tenantId);
  if (!usage) return false;
  return usage.creditsUtilises + requiredCredits <= usage.creditsPlafond;
}

export async function remainingBudget(tenantId: string): Promise<number> {
  const usage = await ensureUsageRow(tenantId);
  if (!usage) return 0;
  return Math.max(0, usage.creditsPlafond - usage.creditsUtilises);
}

export async function recordUsage(tenantId: string, credits: number): Promise<void> {
  await ensureUsageRow(tenantId);
  const mois = currentMonth();
  await withTenant(tenantId, async (tx) => {
    await tx
      .update(schema.tenantScrapeUsage)
      .set({ creditsUtilises: sql`${schema.tenantScrapeUsage.creditsUtilises} + ${credits}` })
      .where(and(eq(schema.tenantScrapeUsage.tenantId, tenantId), eq(schema.tenantScrapeUsage.mois, mois)));
  });
}
