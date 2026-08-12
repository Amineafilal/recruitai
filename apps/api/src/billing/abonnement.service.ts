import { Injectable } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import { withTenant, schema } from "@recruitai/db";
import { PLAN_CONFIGS, type PlanId } from "@recruitai/types";

/**
 * État d'abonnement d'une agence : le plan, ses limites, et la consommation
 * réellement constatée.
 *
 * Les limites du plan ne servent à rien sans le chiffre en face. Un recruteur
 * qui voit « 10 000 profils » ignore s'il en est à 200 ou à 9 800 — et
 * découvre le plafond le jour où un import est refusé.
 */
export interface EtatAbonnement {
  plan: PlanId;
  libelle: string;
  prixMensuelCents: number;
  /**
   * Chaque ligne : une limite du plan et son occupation actuelle. `plafond` à
   * null signifie « sans limite » — le cas du plan Enterprise. L'interface doit
   * l'écrire, pas afficher « 0 » ni une barre pleine.
   */
  usages: { cle: string; libelle: string; utilise: number; plafond: number | null }[];
  /**
   * Le paiement en ligne est-il opérationnel ? Faux tant que Stripe n'est pas
   * câblé — l'interface doit le dire plutôt que d'afficher un bouton mort.
   */
  paiementActif: boolean;
}

@Injectable()
export class AbonnementService {
  async etat(tenantId: string): Promise<EtatAbonnement> {
    const mois = new Date().toISOString().slice(0, 7); // "YYYY-MM"

    return withTenant(tenantId, async (tx) => {
      const [agence] = await tx.select().from(schema.tenants).where(eq(schema.tenants.id, tenantId));
      const plan = (agence?.plan ?? "starter") as PlanId;
      const config = PLAN_CONFIGS[plan];

      const [{ n: recruteurs }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.users)
        .where(eq(schema.users.tenantId, tenantId));

      const [{ n: postesOuverts }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.jobs)
        .where(and(eq(schema.jobs.tenantId, tenantId), eq(schema.jobs.statut, "ouvert")));

      const [{ n: profils }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.cvthequeProfiles)
        .where(eq(schema.cvthequeProfiles.tenantId, tenantId));

      const [credits] = await tx
        .select()
        .from(schema.tenantScrapeUsage)
        .where(
          and(
            eq(schema.tenantScrapeUsage.tenantId, tenantId),
            eq(schema.tenantScrapeUsage.mois, mois),
          ),
        );

      return {
        plan,
        libelle: config.label,
        prixMensuelCents: config.priceMonthlyCents,
        usages: [
          { cle: "recruteurs", libelle: "Recruteurs", utilise: recruteurs, plafond: config.maxRecruiters },
          { cle: "postes", libelle: "Postes ouverts", utilise: postesOuverts, plafond: config.maxActiveJobs },
          { cle: "cvtheque", libelle: "Profils en CVthèque", utilise: profils, plafond: config.maxCvthequeProfiles },
          {
            cle: "credits",
            libelle: "Crédits de recherche ce mois-ci",
            utilise: credits?.creditsUtilises ?? 0,
            plafond: config.monthlyScrapeCreditsCap,
          },
        ],
        // Volontairement calculé, jamais codé en dur : le jour où la clé est
        // renseignée, l'interface bascule sans qu'on ait à y repasser.
        paiementActif: Boolean(process.env.STRIPE_SECRET_KEY),
      };
    });
  }
}
