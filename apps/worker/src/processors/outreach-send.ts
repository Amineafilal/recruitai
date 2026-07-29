import type { Job } from "bullmq";
import { eq } from "drizzle-orm";
import { withTenant, schema, selectionnerCiblesRelance } from "@recruitai/db";
import { renderTemplate, appendOptOutFooter } from "../outreach/template.js";
import { sendEmail } from "../outreach/mailer.js";
import type { OutreachSendJobData } from "../queues.js";

interface CvthequeContact {
  email?: string;
  prenom?: string;
  nom?: string;
  [key: string]: unknown;
}

const MAX_PAR_CYCLE = 200;

function optOutUrl(token: string): string {
  const base = process.env.PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/desinscription/${token}`;
}

/**
 * Envoie les relances d'une campagne pour un tenant.
 *
 * Garde-fous RGPD appliqués dans cet ordre, avant tout envoi :
 *  1. opt-out : un candidat qui s'est désinscrit n'est jamais recontacté,
 *     y compris si sa fiche a été recréée par un import ultérieur (on
 *     compare aussi la dedupe_key, pas seulement l'id de profil) ;
 *  2. anti-relance : pas de nouveau message avant delaiMinRelanceJours ;
 *  3. journalisation : chaque envoi laisse une trace dans outreach_messages
 *     et audit_log, y compris les échecs et les blocages.
 */
export async function processOutreachSend(job: Job<OutreachSendJobData>): Promise<void> {
  const { tenantId, campaignId } = job.data;

  const campaign = await withTenant(tenantId, async (tx) => {
    const [row] = await tx.select().from(schema.campaigns).where(eq(schema.campaigns.id, campaignId));
    return row;
  });

  if (!campaign || campaign.statut !== "actif") {
    job.log(`Campagne ${campaignId} inexistante ou inactive, rien à envoyer.`);
    return;
  }

  const expediteur = process.env.OUTREACH_FROM_EMAIL;
  if (!expediteur) {
    throw new Error("OUTREACH_FROM_EMAIL is not set");
  }

  // Sélection (et garde-fous RGPD) centralisée dans @recruitai/db pour que le
  // worker et les tests partagent exactement la même implémentation.
  const cibles = await selectionnerCiblesRelance(tenantId, campaign.delaiMinRelanceJours, MAX_PAR_CYCLE);

  for (const profil of cibles) {
    const contact = profil.contact as CvthequeContact;
    const destinataire = contact.email!;

    const corps = appendOptOutFooter(
      renderTemplate(campaign.template, contact as Record<string, unknown>),
      optOutUrl(profil.optOutToken),
    );
    const sujet = renderTemplate(campaign.sujet, contact as Record<string, unknown>);

    try {
      const { providerMessageId } = await sendEmail({
        to: destinataire,
        subject: sujet,
        html: corps,
        from: expediteur,
      });

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
          acteur: "worker:outreach",
        });
      });
    } catch (err) {
      job.log(`Échec d'envoi à ${destinataire}: ${String(err)}`);
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
}
