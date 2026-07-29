import { Injectable, Logger } from "@nestjs/common";
import { and, asc, eq, isNull, or, lt } from "drizzle-orm";
import { getAdminDb, withTenant, schema } from "@recruitai/db";
import { ApifyService } from "../sourcing/apify.service.js";
import { budgetRestant, enregistrerUsage } from "./scrape-budget.js";

/**
 * Profils relus par passage. Volontairement modeste : l'enrichissement tourne
 * toutes les nuits, mieux vaut avancer par petits lots réguliers qu'épuiser
 * le budget mensuel en une seule nuit.
 */
const LOT_PAR_DEFAUT = 100;

/** Un profil relu il y a moins de 30 jours est considéré à jour. */
const FRAICHEUR_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Forme minimale attendue dans cvtheque_profiles.contact. La colonne est un
 * jsonb libre (les CSV clients ont des colonnes variables) : on ne type que
 * ce dont l'enrichissement a besoin.
 */
interface CvthequeContact {
  linkedinUrl?: string;
  poste?: string;
  diplome?: string;
  [key: string]: unknown;
}

export interface ResultatEnrichissement {
  profilsRelus: number;
  signaux: number;
  raison?: string;
}

/**
 * Enrichissement de la CVthèque : c'est la moitié « intelligente » du module.
 *
 * On relit périodiquement les profils LinkedIn déjà en base et on compare au
 * dernier état connu. Un changement de poste ou de diplôme fait passer le
 * candidat en « chaud » et enregistre un signal — c'est ce signal qui rend le
 * profil éligible aux campagnes de relance.
 *
 * Chaque profil relu consomme un crédit de scraping réel, d'où le double
 * garde-fou : plafond mensuel par agence (scrape-budget) et taille de lot.
 */
@Injectable()
export class EnrichRunner {
  private readonly logger = new Logger(EnrichRunner.name);

  constructor(private readonly apify: ApifyService) {}

  /** Enrichit une agence. Retourne le détail pour l'affichage et les logs. */
  async enrichirTenant(tenantId: string, lotMax?: number): Promise<ResultatEnrichissement> {
    const actorId = this.apify.actorId("linkedin");
    if (!this.apify.token() || !actorId) {
      return { profilsRelus: 0, signaux: 0, raison: "Scraping non configuré (APIFY_TOKEN / actor absent)." };
    }

    const budget = await budgetRestant(tenantId);
    if (budget <= 0) {
      return { profilsRelus: 0, signaux: 0, raison: "Budget de scraping mensuel épuisé." };
    }

    const taille = Math.min(lotMax ?? Number(process.env.ENRICH_BATCH_SIZE ?? LOT_PAR_DEFAUT), budget);
    const seuil = new Date(Date.now() - FRAICHEUR_MS);

    // Les moins récemment rafraîchis d'abord : sur plusieurs nuits, toute la
    // base finit par passer sans jamais relire deux fois les mêmes.
    const candidats = await withTenant(tenantId, (tx) =>
      tx
        .select()
        .from(schema.cvthequeProfiles)
        .where(
          and(
            eq(schema.cvthequeProfiles.tenantId, tenantId),
            or(
              isNull(schema.cvthequeProfiles.dernierEnrichissementAt),
              lt(schema.cvthequeProfiles.dernierEnrichissementAt, seuil),
            ),
          ),
        )
        .orderBy(asc(schema.cvthequeProfiles.dernierEnrichissementAt))
        .limit(taille),
    );

    // Sans URL LinkedIn il n'y a rien à relire : ces fiches sont ignorées
    // plutôt que de gaspiller un crédit.
    const avecUrl = candidats.filter((c) => (c.contact as CvthequeContact)?.linkedinUrl);
    if (avecUrl.length === 0) {
      return { profilsRelus: 0, signaux: 0, raison: "Aucun profil à rafraîchir (ou aucune URL LinkedIn)." };
    }

    const urls = avecUrl.map((c) => (c.contact as CvthequeContact).linkedinUrl!);
    const { runId, items } = await this.apify.runActor<CvthequeContact & { linkedinUrl?: string }>(actorId, {
      profileUrls: urls,
    });

    // Le budget est décompté sur ce qui a réellement été demandé, même si
    // l'actor renvoie moins de profils que prévu : le fournisseur facture la
    // tentative, pas le succès.
    await enregistrerUsage(tenantId, Math.max(items.length, avecUrl.length));

    let signaux = 0;
    await withTenant(tenantId, async (tx) => {
      await tx.insert(schema.rawScrapeResults).values({
        tenantId,
        source: "linkedin",
        apifyRunId: runId,
        payload: items,
        statut: "ingested",
      });

      const parUrl = new Map(items.filter((i) => i.linkedinUrl).map((i) => [i.linkedinUrl!, i]));

      for (const profil of avecUrl) {
        const avant = profil.contact as CvthequeContact;
        const frais = parUrl.get(avant.linkedinUrl!);
        if (!frais) continue;

        // Un champ absent de la réponse ne vaut PAS un changement : sans ce
        // contrôle, un profil dont l'actor ne renvoie plus le poste passerait
        // en « chaud » à tort et déclencherait une relance injustifiée.
        const posteChange = Boolean(frais.poste) && frais.poste !== avant.poste;
        const diplomeChange = Boolean(frais.diplome) && frais.diplome !== avant.diplome;
        const change = posteChange || diplomeChange;

        await tx
          .update(schema.cvthequeProfiles)
          .set({
            contact: { ...avant, ...frais },
            dernierEnrichissementAt: new Date(),
            statutChaud: change ? true : profil.statutChaud,
          })
          .where(eq(schema.cvthequeProfiles.id, profil.id));

        if (change) {
          await tx.insert(schema.signals).values({
            tenantId,
            profileId: profil.id,
            type: posteChange ? "changement_poste" : "nouveau_diplome",
          });
          signaux += 1;
        }
      }

      await tx.insert(schema.auditLog).values({
        tenantId,
        action: `cvtheque_enrichie profils=${avecUrl.length} signaux=${signaux}`,
        acteur: "api:enrichissement",
      });
    });

    this.logger.log(`Tenant ${tenantId} : ${avecUrl.length} profil(s) relu(s), ${signaux} signal(aux).`);
    return { profilsRelus: avecUrl.length, signaux };
  }

  /** Toutes les agences, pour le cron nocturne. */
  async enrichirToutesLesAgences(): Promise<{ tenants: number; profilsRelus: number; signaux: number }> {
    const tenants = await getAdminDb().select({ id: schema.tenants.id }).from(schema.tenants);
    let profilsRelus = 0;
    let signaux = 0;

    // En série : chaque agence consomme du quota Apify partagé, et un run
    // parallèle sur dix agences ferait exploser la facture d'un coup.
    for (const tenant of tenants) {
      try {
        const res = await this.enrichirTenant(tenant.id);
        profilsRelus += res.profilsRelus;
        signaux += res.signaux;
      } catch (err) {
        this.logger.error(`Enrichissement échoué (tenant ${tenant.id}) : ${String(err)}`);
      }
    }
    return { tenants: tenants.length, profilsRelus, signaux };
  }
}
