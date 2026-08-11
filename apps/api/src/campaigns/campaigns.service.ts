import { Injectable, NotFoundException } from "@nestjs/common";
import { desc, eq, sql } from "drizzle-orm";
import { withTenant, schema } from "@recruitai/db";
import type { CampaignInput } from "@recruitai/types";

@Injectable()
export class CampaignsService {
  /**
   * Campagnes de l'agence, avec le bilan de leurs envois.
   *
   * Les compteurs sont joints ici plutôt que calculés dans l'interface : une
   * campagne sans aucune trace d'envoi et une campagne dont tous les envois
   * ont échoué se ressemblent à l'écran, alors qu'elles appellent des actions
   * opposées. Sans ces chiffres, le recruteur ne peut pas faire la différence.
   */
  async list(tenantId: string) {
    return withTenant(tenantId, async (tx) => {
      const campagnes = await tx
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.tenantId, tenantId));
      if (campagnes.length === 0) return [];

      const bilans = await tx
        .select({
          campaignId: schema.outreachMessages.campaignId,
          envoyes: sql<number>`count(*) filter (where ${schema.outreachMessages.statut} = 'envoye')::int`,
          echecs: sql<number>`count(*) filter (where ${schema.outreachMessages.statut} = 'echec')::int`,
          dernierEnvoi: sql<
            string | null
          >`max(${schema.outreachMessages.envoyeAt}) filter (where ${schema.outreachMessages.statut} = 'envoye')`,
        })
        .from(schema.outreachMessages)
        .where(eq(schema.outreachMessages.tenantId, tenantId))
        .groupBy(schema.outreachMessages.campaignId);

      const parCampagne = new Map(bilans.map((b) => [b.campaignId, b]));
      return campagnes.map((c) => {
        const b = parCampagne.get(c.id);
        return {
          ...c,
          envoyes: b?.envoyes ?? 0,
          echecs: b?.echecs ?? 0,
          dernierEnvoi: b?.dernierEnvoi ?? null,
        };
      });
    });
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
