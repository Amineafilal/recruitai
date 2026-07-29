import { Injectable, Logger } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { withTenant, schema, selectionnerCiblesRelance } from "@recruitai/db";
import { MailerService } from "../mail/mailer.service.js";
import { renderTemplate, appendOptOutFooter } from "./template.js";

interface CvthequeContact {
  email?: string;
  prenom?: string;
  nom?: string;
  [key: string]: unknown;
}

/** Plafond par cycle : protège la réputation d'envoi du domaine. */
const MAX_PAR_CYCLE = 200;

export interface ResultatRelance {
  envoyes: number;
  echecs: number;
}

/**
 * Envoi des relances d'une campagne, déclenché par le scheduler ou à la main
 * depuis l'écran Campagnes.
 *
 * Garde-fous RGPD appliqués dans cet ordre, avant tout envoi :
 *  1. opt-out : un candidat désinscrit n'est jamais recontacté, y compris si
 *     sa fiche a été recréée par un import ultérieur (la comparaison porte
 *     sur la dedupe_key, pas sur l'id de profil) ;
 *  2. anti-relance : pas de nouveau message avant delaiMinRelanceJours ;
 *  3. journalisation : chaque envoi laisse une trace dans outreach_messages
 *     et audit_log, y compris les échecs.
 *
 * La sélection elle-même vit dans @recruitai/db afin que ces règles ne
 * puissent pas diverger entre l'API, le worker et les tests.
 */
@Injectable()
export class OutreachRunner {
  private readonly logger = new Logger(OutreachRunner.name);

  constructor(private readonly mailer: MailerService) {}

  private optOutUrl(token: string): string {
    return `${this.mailer.appUrl()}/desinscription/${token}`;
  }

  async envoyerCampagne(tenantId: string, campaignId: string): Promise<ResultatRelance> {
    const campaign = await withTenant(tenantId, async (tx) => {
      const [row] = await tx.select().from(schema.campaigns).where(eq(schema.campaigns.id, campaignId));
      return row;
    });

    if (!campaign || campaign.statut !== "actif") {
      this.logger.log(`Campagne ${campaignId} inexistante ou en pause — rien à envoyer.`);
      return { envoyes: 0, echecs: 0 };
    }

    const cibles = await selectionnerCiblesRelance(tenantId, campaign.delaiMinRelanceJours, MAX_PAR_CYCLE);
    let envoyes = 0;
    let echecs = 0;

    for (const profil of cibles) {
      const contact = profil.contact as CvthequeContact;
      const destinataire = contact.email!;
      const variables = contact as Record<string, unknown>;

      const sujet = renderTemplate(campaign.sujet, variables);
      const corps = appendOptOutFooter(
        renderTemplate(campaign.template, variables),
        this.optOutUrl(profil.optOutToken),
      );

      try {
        const { providerMessageId } = await this.mailer.send({ to: destinataire, subject: sujet, html: corps });
        await withTenant(tenantId, async (tx) => {
          await tx.insert(schema.outreachMessages).values({
            tenantId,
            profileId: profil.id,
            campaignId,
            destinataire,
            sujet,
            statut: "envoye",
            providerMessageId,
          });
          await tx.insert(schema.auditLog).values({
            tenantId,
            action: `relance_envoyee campagne=${campaignId} profil=${profil.id}`,
            acteur: "api:outreach",
          });
        });
        envoyes += 1;
      } catch (err) {
        echecs += 1;
        this.logger.warn(`Échec d'envoi à ${destinataire}: ${String(err)}`);
        await withTenant(tenantId, async (tx) => {
          await tx.insert(schema.outreachMessages).values({
            tenantId,
            profileId: profil.id,
            campaignId,
            destinataire,
            sujet,
            statut: "echec",
            erreur: String(err).slice(0, 1000),
          });
        });
      }
    }

    this.logger.log(`Campagne ${campaignId}: ${envoyes} envoyés, ${echecs} échecs.`);
    return { envoyes, echecs };
  }
}
