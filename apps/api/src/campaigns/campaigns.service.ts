import { Injectable, NotFoundException } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import { withTenant, schema } from "@recruitai/db";
import type { CampaignInput } from "@recruitai/types";

@Injectable()
export class CampaignsService {
  async list(tenantId: string) {
    return withTenant(tenantId, (tx) =>
      tx.select().from(schema.campaigns).where(eq(schema.campaigns.tenantId, tenantId)),
    );
  }

  async create(tenantId: string, input: CampaignInput) {
    return withTenant(tenantId, async (tx) => {
      const [created] = await tx
        .insert(schema.campaigns)
        .values({ tenantId, ...input })
        .returning();
      await tx.insert(schema.auditLog).values({
        tenantId,
        action: `campagne_creee id=${created.id}`,
        acteur: "api",
      });
      return created;
    });
  }

  async setStatus(tenantId: string, campaignId: string, statut: "actif" | "pause") {
    return withTenant(tenantId, async (tx) => {
      const [updated] = await tx
        .update(schema.campaigns)
        .set({ statut })
        .where(eq(schema.campaigns.id, campaignId))
        .returning();
      if (!updated) throw new NotFoundException(`Campagne ${campaignId} introuvable`);
      return updated;
    });
  }

  async update(tenantId: string, campaignId: string, input: CampaignInput) {
    return withTenant(tenantId, async (tx) => {
      const [updated] = await tx
        .update(schema.campaigns)
        .set({ ...input })
        .where(eq(schema.campaigns.id, campaignId))
        .returning();
      if (!updated) throw new NotFoundException(`Campagne ${campaignId} introuvable`);
      await tx.insert(schema.auditLog).values({
        tenantId,
        action: `campagne_modifiee id=${campaignId}`,
        acteur: "api",
      });
      return updated;
    });
  }

  /**
   * Suppression d'une campagne. Ses messages envoyés partent en cascade —
   * acceptable ici car outreach_messages sert l'anti-doublon interne, tandis
   * que la preuve RGPD durable vit dans consents et audit_log, tous deux
   * conservés.
   */
  async remove(tenantId: string, campaignId: string): Promise<void> {
    await withTenant(tenantId, async (tx) => {
      const [supprimee] = await tx
        .delete(schema.campaigns)
        .where(eq(schema.campaigns.id, campaignId))
        .returning();
      if (!supprimee) throw new NotFoundException(`Campagne ${campaignId} introuvable`);
      await tx.insert(schema.auditLog).values({
        tenantId,
        action: `campagne_supprimee nom=${supprimee.nom}`,
        acteur: "api",
      });
    });
  }

  /** Historique des envois — sert aussi de preuve de traitement RGPD. */
  async messages(tenantId: string) {
    return withTenant(tenantId, (tx) =>
      tx
        .select()
        .from(schema.outreachMessages)
        .where(eq(schema.outreachMessages.tenantId, tenantId))
        .orderBy(desc(schema.outreachMessages.envoyeAt))
        .limit(500),
    );
  }
}
