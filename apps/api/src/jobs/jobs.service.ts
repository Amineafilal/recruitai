import { Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { withTenant, schema } from "@recruitai/db";
import type { JobCriteria, JobStatus } from "@recruitai/types";
import { SourcingRunner } from "../sourcing/sourcing-runner.js";

@Injectable()
export class JobsService {
  constructor(private readonly sourcingRunner: SourcingRunner) {}

  async list(tenantId: string) {
    return withTenant(tenantId, (tx) => tx.select().from(schema.jobs).where(eq(schema.jobs.tenantId, tenantId)));
  }

  async create(tenantId: string, criteres: JobCriteria) {
    const created = await withTenant(tenantId, async (tx) => {
      const [row] = await tx.insert(schema.jobs).values({ tenantId, criteres }).returning();
      return row;
    });
    // Sourcing automatique en tâche de fond : la réponse HTTP part tout de
    // suite, les candidats arrivent ~1 min plus tard.
    this.sourcingRunner.runInBackground(tenantId, created.id);
    return created;
  }

  async get(tenantId: string, jobId: string) {
    return withTenant(tenantId, async (tx) => {
      const [job] = await tx.select().from(schema.jobs).where(eq(schema.jobs.id, jobId));
      if (!job) throw new NotFoundException(`Poste ${jobId} introuvable`);
      return job;
    });
  }

  async updateStatus(tenantId: string, jobId: string, statut: JobStatus) {
    return withTenant(tenantId, async (tx) => {
      const [updated] = await tx.update(schema.jobs).set({ statut }).where(eq(schema.jobs.id, jobId)).returning();
      if (!updated) throw new NotFoundException(`Poste ${jobId} introuvable`);
      return updated;
    });
  }

  /**
   * Modification des critères d'un poste.
   *
   * Ne relance PAS le sourcing automatiquement : chaque relance consomme du
   * quota Apify et des appels Mistral. Corriger une faute de frappe dans un
   * intitulé ne doit pas coûter une recherche complète — le recruteur
   * déclenche lui-même une nouvelle recherche s'il le souhaite.
   */
  async update(tenantId: string, jobId: string, criteres: JobCriteria) {
    return withTenant(tenantId, async (tx) => {
      const [updated] = await tx
        .update(schema.jobs)
        .set({ criteres })
        .where(eq(schema.jobs.id, jobId))
        .returning();
      if (!updated) throw new NotFoundException(`Poste ${jobId} introuvable`);
      await tx.insert(schema.auditLog).values({
        tenantId,
        action: `poste_modifie id=${jobId}`,
        acteur: "api",
      });
      return updated;
    });
  }

  /**
   * Suppression d'un poste. La cascade emporte ses candidats sourcés (et
   * leurs notes) : c'est voulu, une shortlist n'a pas de sens sans son poste.
   */
  async remove(tenantId: string, jobId: string): Promise<void> {
    await withTenant(tenantId, async (tx) => {
      const [supprime] = await tx.delete(schema.jobs).where(eq(schema.jobs.id, jobId)).returning();
      if (!supprime) throw new NotFoundException(`Poste ${jobId} introuvable`);
      await tx.insert(schema.auditLog).values({
        tenantId,
        action: `poste_supprime id=${jobId}`,
        acteur: "api",
      });
    });
  }

  /** Relance manuelle de la recherche sur un poste existant. */
  relancerSourcing(tenantId: string, jobId: string): void {
    this.sourcingRunner.runInBackground(tenantId, jobId);
  }
}
