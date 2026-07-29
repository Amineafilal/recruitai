import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { eq } from "drizzle-orm";
import { getAdminDb, schema } from "@recruitai/db";
import { SourcingRunner } from "../sourcing/sourcing-runner.js";
import { OutreachRunner } from "../outreach/outreach.runner.js";
import { PurgeRunner } from "../rgpd/purge.runner.js";
import { EnrichRunner } from "../cvtheque/enrich.runner.js";

/**
 * Automatisation quotidienne du produit.
 *
 * Pourquoi ici et pas dans apps/worker : le worker BullMQ exige un Redis
 * joignable en permanence, et un worker 24/7 vide le quota Upstash gratuit
 * même sans travail à faire. L'API, elle, tourne déjà en continu pour servir
 * les requêtes — y héberger les crons ne coûte donc rien de plus et supprime
 * toute dépendance à Redis. Le worker reste en place pour le jour où le
 * volume justifiera de repasser sur une file dédiée.
 *
 * Conséquence à connaître pour le déploiement : ces crons s'exécutent dans
 * CHAQUE instance de l'API. Tant qu'on tourne sur une seule instance (cas
 * actuel), c'est sans effet. Avant de passer à plusieurs instances, activer
 * SCHEDULER_ENABLED=false sur toutes sauf une, sinon les relances partiraient
 * en double.
 *
 * Les énumérations cross-tenant ci-dessous (tous les postes ouverts, toutes
 * les agences) passent par getAdminDb() : c'est le seul endroit du code
 * applicatif qui a légitimement besoin de lire au-delà d'un tenant. Chaque
 * traitement redescend ensuite dans withTenant() pour l'écriture.
 */
@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly sourcing: SourcingRunner,
    private readonly outreach: OutreachRunner,
    private readonly purge: PurgeRunner,
    private readonly enrich: EnrichRunner,
  ) {}

  private actif(): boolean {
    return process.env.SCHEDULER_ENABLED !== "false";
  }

  /** Shortlist du matin : 06:00, tous les jours, sur chaque poste ouvert. */
  @Cron("0 6 * * *", { name: "sourcing-quotidien", timeZone: "Europe/Paris" })
  async sourcingQuotidien(): Promise<void> {
    if (!this.actif()) return;
    const postes = await getAdminDb().select().from(schema.jobs).where(eq(schema.jobs.statut, "ouvert"));
    this.logger.log(`Sourcing quotidien : ${postes.length} poste(s) ouvert(s).`);

    // En série et non en parallèle : chaque poste consomme du quota Apify et
    // des appels Mistral. Sérialiser lisse la charge et rend un dépassement
    // de quota lisible dans les logs plutôt que massif et simultané.
    for (const poste of postes) {
      await this.sourcing.sourcePoste(poste.tenantId, poste.id).catch((err) => {
        this.logger.error(`Sourcing quotidien échoué (poste ${poste.id}): ${String(err)}`);
      });
    }

    // Deuxième chance pour les profils que l'IA n'a pas pu noter (limite de
    // débit, timeout). Sans ce rattrapage ils resteraient sans note
    // indéfiniment et n'apparaîtraient jamais dans une shortlist classée.
    const rescoring = await this.sourcing.rescorerToutesLesAgences().catch((err) => {
      this.logger.error(`Re-scoring échoué : ${String(err)}`);
      return null;
    });
    if (rescoring && rescoring.traites > 0) {
      this.logger.log(`Re-scoring : ${rescoring.reussis}/${rescoring.traites} candidat(s) récupéré(s).`);
    }
  }

  /**
   * Relances : 09:00 en semaine seulement. Un email de recrutement reçu à 3h
   * du matin ou un dimanche fait fuir le candidat et abîme la réputation
   * d'envoi du domaine.
   */
  @Cron("0 9 * * 1-5", { name: "relances", timeZone: "Europe/Paris" })
  async relancesQuotidiennes(): Promise<void> {
    if (!this.actif()) return;
    const campagnes = await getAdminDb()
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.statut, "actif"));
    this.logger.log(`Relances : ${campagnes.length} campagne(s) active(s).`);

    for (const campagne of campagnes) {
      await this.outreach.envoyerCampagne(campagne.tenantId, campagne.id).catch((err) => {
        this.logger.error(`Relance échouée (campagne ${campagne.id}): ${String(err)}`);
      });
    }
  }

  /**
   * Enrichissement CVthèque : 02:00 chaque nuit.
   *
   * C'est ce passage qui fait passer les candidats en « chaud » et alimente
   * les campagnes de relance — sans lui, la CVthèque reste une base morte.
   * Il tourne avant les relances de 09:00 pour que les signaux détectés la
   * nuit soient exploitables le matin même.
   */
  @Cron("0 2 * * *", { name: "enrichissement-cvtheque", timeZone: "Europe/Paris" })
  async enrichissementNocturne(): Promise<void> {
    if (!this.actif()) return;
    const res = await this.enrich.enrichirToutesLesAgences().catch((err) => {
      this.logger.error(`Enrichissement CVthèque échoué : ${String(err)}`);
      return null;
    });
    if (res) {
      this.logger.log(
        `Enrichissement CVthèque : ${res.profilsRelus} profil(s) relu(s) sur ${res.tenants} agence(s), ${res.signaux} signal(aux).`,
      );
    }
  }

  /** Purge de rétention : dimanche 03:00, hors heures d'activité. */
  @Cron("0 3 * * 0", { name: "purge-rgpd", timeZone: "Europe/Paris" })
  async purgeHebdomadaire(): Promise<void> {
    if (!this.actif()) return;
    const supprimes = await this.purge.purger().catch((err) => {
      this.logger.error(`Purge RGPD échouée: ${String(err)}`);
      return 0;
    });
    this.logger.log(`Purge RGPD hebdomadaire : ${supprimes} profil(s) supprimé(s).`);
  }
}
