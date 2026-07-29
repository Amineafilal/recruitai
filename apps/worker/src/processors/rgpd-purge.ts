import type { Job } from "bullmq";
import { eq, inArray } from "drizzle-orm";
import { getAdminDb, withTenant, schema, selectionnerProfilsObsoletes } from "@recruitai/db";

/**
 * Durée de conservation des données candidats. La CNIL recommande 2 ans à
 * compter du dernier contact pour les données de recrutement non retenues.
 * Configurable par variable d'env si un client a une politique plus stricte.
 */
const RETENTION_MOIS = Number(process.env.RGPD_RETENTION_MOIS ?? 24);

/**
 * Supprime les profils CVthèque sans interaction depuis la durée de
 * rétention. Les consentements (dont les opt-out) ne sont PAS supprimés :
 * effacer un opt-out reviendrait à autoriser un nouveau démarchage de la
 * personne au prochain import du même fichier — l'inverse de l'objectif.
 */
export async function processRgpdPurge(job: Job<{ tenantId?: string }>): Promise<void> {
  const tenants = job.data.tenantId
    ? [{ id: job.data.tenantId }]
    : await getAdminDb().select({ id: schema.tenants.id }).from(schema.tenants);

  for (const tenant of tenants) {
    const obsoletes = await selectionnerProfilsObsoletes(tenant.id, RETENTION_MOIS);
    if (obsoletes.length === 0) continue;

    await withTenant(tenant.id, async (tx) => {
      // Suppression en un seul DELETE plutôt qu'une requête par profil : une
      // purge peut porter sur plusieurs milliers de fiches.
      await tx.delete(schema.cvthequeProfiles).where(
        inArray(
          schema.cvthequeProfiles.id,
          obsoletes.map((p) => p.id),
        ),
      );

      await tx.insert(schema.auditLog).values({
        tenantId: tenant.id,
        action: `purge_rgpd profils_supprimes=${obsoletes.length} retention_mois=${RETENTION_MOIS}`,
        acteur: "worker:rgpd-purge",
      });
    });

    job.log(`Tenant ${tenant.id}: ${obsoletes.length} profils purgés (rétention ${RETENTION_MOIS} mois).`);
  }
}
