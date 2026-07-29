import { Controller, Post, ForbiddenException } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { CurrentTenant } from "../tenant/tenant.decorator.js";
import type { TenantContext } from "../tenant/tenant-context.js";
import { SchedulerService } from "./scheduler.service.js";
import { EnrichRunner } from "../cvtheque/enrich.runner.js";
import { SourcingRunner } from "../sourcing/sourcing-runner.js";

/**
 * Déclenchement manuel des automatisations, pour ne pas avoir à attendre
 * 06:00 quand on veut vérifier que la chaîne fonctionne — et pour donner au
 * recruteur un bouton « relancer maintenant ».
 */
@Controller("automatisations")
export class SchedulerController {
  constructor(
    private readonly scheduler: SchedulerService,
    private readonly registry: SchedulerRegistry,
    private readonly enrich: EnrichRunner,
    private readonly sourcingRunner: SourcingRunner,
  ) {}

  private exigerAdmin(tenant: TenantContext): void {
    if (tenant.role !== "admin") {
      throw new ForbiddenException("Réservé aux administrateurs de l'agence.");
    }
  }

  /** État des crons : prochaine exécution prévue, pour l'écran Paramètres. */
  @Post("etat")
  etat(@CurrentTenant() tenant: TenantContext) {
    this.exigerAdmin(tenant);
    const noms = ["sourcing-quotidien", "enrichissement-cvtheque", "relances", "purge-rgpd"];
    return {
      actif: process.env.SCHEDULER_ENABLED !== "false",
      taches: noms.map((nom) => {
        try {
          const job = this.registry.getCronJob(nom);
          return { nom, prochaine: job.nextDate()?.toISO() ?? null };
        } catch {
          return { nom, prochaine: null };
        }
      }),
    };
  }

  @Post("sourcing")
  async lancerSourcing(@CurrentTenant() tenant: TenantContext) {
    this.exigerAdmin(tenant);
    await this.scheduler.sourcingQuotidien();
    return { ok: true };
  }

  @Post("relances")
  async lancerRelances(@CurrentTenant() tenant: TenantContext) {
    this.exigerAdmin(tenant);
    await this.scheduler.relancesQuotidiennes();
    return { ok: true };
  }

  /** Relance le scoring des candidats de l'agence restés sans note. */
  @Post("rescoring")
  async lancerRescoring(@CurrentTenant() tenant: TenantContext) {
    this.exigerAdmin(tenant);
    return this.sourcingRunner.rescorerEchecs(tenant.tenantId);
  }

  /**
   * Enrichit uniquement l'agence courante (pas toutes) : ce bouton consomme
   * du quota de scraping, il ne doit pas engager les autres clients.
   */
  @Post("enrichissement")
  async lancerEnrichissement(@CurrentTenant() tenant: TenantContext) {
    this.exigerAdmin(tenant);
    return this.enrich.enrichirTenant(tenant.tenantId);
  }

  @Post("purge")
  async lancerPurge(@CurrentTenant() tenant: TenantContext) {
    this.exigerAdmin(tenant);
    await this.scheduler.purgeHebdomadaire();
    return { ok: true };
  }
}
