import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, ne, sql } from "drizzle-orm";
import { withTenant, schema } from "@recruitai/db";
import { PLAN_CONFIGS, type JobCriteria, type JobStatus, type PlanId } from "@recruitai/types";
import { SourcingRunner } from "../sourcing/sourcing-runner.js";

@Injectable()
export class JobsService {
  constructor(private readonly sourcingRunner: SourcingRunner) {}

  /**
   * Refuse d'ouvrir un poste de plus quand la formule est déjà saturée.
   *
   * La limite `maxActiveJobs` existait dans PLAN_CONFIGS mais n'était vérifiée
   * nulle part : une agence en formule Starter, plafonnée à 5, en avait 7
   * ouverts. Chaque poste ouvert déclenche un sourcing quotidien facturé — la
   * limite n'est donc pas décorative, elle protège la marge.
   *
   * `exclureJobId` sert à la réouverture : le poste qu'on rouvre ne doit pas se
   * compter lui-même, sinon rouvrir le dernier poste d'une formule pleine
   * échouerait alors qu'il ne change rien au total.
   */
  private async verifierQuotaPostes(tenantId: string, exclureJobId?: string): Promise<void> {
    const { plan, ouverts } = await withTenant(tenantId, async (tx) => {
      const [agence] = await tx.select().from(schema.tenants).where(eq(schema.tenants.id, tenantId));
      const [compte] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.jobs)
        .where(
          and(
            eq(schema.jobs.tenantId, tenantId),
            eq(schema.jobs.statut, "ouvert"),
            ...(exclureJobId ? [ne(schema.jobs.id, exclureJobId)] : []),
          ),
        );
      return { plan: (agence?.plan ?? "starter") as PlanId, ouverts: compte?.n ?? 0 };
    });

    const config = PLAN_CONFIGS[plan];
    const plafond = config.maxActiveJobs;
    // null = sans limite (formule Enterprise).
    if (plafond === null || ouverts < plafond) return;

    // Le message dit le chiffre, la formule ET la sortie. « Limite atteinte »
    // seul laisserait le recruteur sans rien à faire.
    throw new ForbiddenException(
      `Votre formule ${config.label} autorise ${plafond} poste(s) ouvert(s), et vous en avez ` +
        `déjà ${ouverts}. Mettez un poste en pause ou clôturez-le pour en ouvrir un autre, ` +
        `ou changez de formule depuis la page Abonnement.`,
    );
  }

  async list(tenantId: string) {
    return withTenant(tenantId, (tx) => tx.select().from(schema.jobs).where(eq(schema.jobs.tenantId, tenantId)));
  }

  async create(tenantId: string, criteres: JobCriteria) {
    await this.verifierQuotaPostes(tenantId);
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
    // Sans ce contrôle, la limite se contournait en deux clics : mettre un
    // poste en pause, en créer un autre, puis rouvrir le premier.
    if (statut === "ouvert") await this.verifierQuotaPostes(tenantId, jobId);

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
