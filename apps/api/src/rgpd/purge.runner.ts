import { Injectable, Logger } from "@nestjs/common";
import { inArray } from "drizzle-orm";
import { getAdminDb, withTenant, schema, selectionnerProfilsObsoletes } from "@recruitai/db";

/**
 * Durée de conservation des données candidats. La CNIL recommande 2 ans à
 * compter du dernier contact pour les données de recrutement non retenues.
 * Configurable si un client applique une politique plus stricte.
 */
function retentionMois(): number {
  return Number(process.env.RGPD_RETENTION_MOIS ?? 24);
}

@Injectable()
export class PurgeRunner {
  private readonly logger = new Logger(PurgeRunner.name);

  /**
   * Supprime les profils CVthèque sans interaction depuis la durée de
   * rétention. Les consentements (dont les opt-out) ne sont PAS supprimés :
   * effacer un opt-out reviendrait à réautoriser le démarchage de la personne
   * au prochain import du même fichier — l'inverse de l'objectif.
   */
  async purger(tenantId?: string): Promise<number> {
    const mois = retentionMois();
    const tenants = tenantId
      ? [{ id: tenantId }]
      : await getAdminDb().select({ id: schema.tenants.id }).from(schema.tenants);

    let total = 0;
    for (const tenant of tenants) {
      const obsoletes = await selectionnerProfilsObsoletes(tenant.id, mois);
      if (obsoletes.length === 0) continue;

      await withTenant(tenant.id, async (tx) => {
        // Un seul DELETE plutôt qu'une requête par profil : une purge peut
        // porter sur plusieurs milliers de fiches.
        await tx.delete(schema.cvthequeProfiles).where(
          inArray(
            schema.cvthequeProfiles.id,
            obsoletes.map((p) => p.id),
          ),
        );
        await tx.insert(schema.auditLog).values({
          tenantId: tenant.id,
          action: `purge_rgpd profils_supprimes=${obsoletes.length} retention_mois=${mois}`,
          acteur: "api:rgpd-purge",
        });
      });

      total += obsoletes.length;
      this.logger.log(`Tenant ${tenant.id}: ${obsoletes.length} profils purgés (rétention ${mois} mois).`);
    }
    return total;
  }
}
