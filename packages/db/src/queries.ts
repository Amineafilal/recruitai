import { and, eq, gt, lt, or, isNull, asc, sql } from "drizzle-orm";
import { withTenant } from "./client.js";
import * as schema from "./schema.js";

interface ContactMinimal {
  email?: string;
  [key: string]: unknown;
}

/**
 * Candidats éligibles à une relance, pour un tenant.
 *
 * Trois filtres RGPD, appliqués ici et nulle part ailleurs pour qu'ils ne
 * puissent pas diverger entre le worker et les tests :
 *  1. exclusion des désinscrits, comparés sur dedupe_key et non sur l'id de
 *     fiche — un ré-import recrée la fiche avec un nouvel id, l'opt-out doit
 *     continuer de s'appliquer ;
 *  2. exclusion des profils contactés depuis moins de `delaiJours`, toutes
 *     campagnes confondues (le délai protège le candidat, pas la campagne) ;
 *  3. exclusion des profils sans email, inexploitables pour une relance.
 */
export async function selectionnerCiblesRelance(
  tenantId: string,
  delaiJours: number,
  limite = 200,
): Promise<(typeof schema.cvthequeProfiles.$inferSelect)[]> {
  const cutoff = new Date(Date.now() - delaiJours * 24 * 60 * 60 * 1000);

  return withTenant(tenantId, async (tx) => {
    const optOuts = await tx
      .select({ dedupeKey: schema.consents.dedupeKey })
      .from(schema.consents)
      .where(and(eq(schema.consents.tenantId, tenantId), eq(schema.consents.type, "opt_out")));
    const clesDesinscrites = new Set(optOuts.map((c) => c.dedupeKey));

    const recents = await tx
      .select({ profileId: schema.outreachMessages.profileId })
      .from(schema.outreachMessages)
      .where(
        and(
          eq(schema.outreachMessages.tenantId, tenantId),
          eq(schema.outreachMessages.statut, "envoye"),
          gt(schema.outreachMessages.envoyeAt, cutoff),
        ),
      );
    const dejaContactes = new Set(recents.map((r) => r.profileId));

    const candidats = await tx
      .select()
      .from(schema.cvthequeProfiles)
      .where(and(eq(schema.cvthequeProfiles.tenantId, tenantId), eq(schema.cvthequeProfiles.statutChaud, true)))
      .limit(limite * 3);

    return candidats
      .filter((p) => !clesDesinscrites.has(p.dedupeKey))
      .filter((p) => !dejaContactes.has(p.id))
      .filter((p) => Boolean((p.contact as ContactMinimal)?.email))
      .slice(0, limite);
  });
}

/**
 * Profils dépassant la durée de rétention : aucun message envoyé depuis
 * `retentionMois`, ou jamais contactés et importés il y a plus longtemps que
 * ça. La date de référence est le dernier envoi réel, pas la date d'import.
 */
export async function selectionnerProfilsObsoletes(
  tenantId: string,
  retentionMois: number,
): Promise<{ id: string }[]> {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - retentionMois);

  // Comparaison écrite en SQL brut avec un ISO string explicitement casté :
  // la colonne agrégée max(envoye_at) provient d'une sous-requête, Drizzle
  // n'en connaît pas le type et transmettrait un objet Date tel quel à
  // postgres-js, qui attend une chaîne (ERR_INVALID_ARG_TYPE à l'exécution).
  const cutoffIso = cutoff.toISOString();

  return withTenant(tenantId, async (tx) => {
    const dernierEnvoi = tx
      .select({
        profileId: schema.outreachMessages.profileId,
        dernier: sql<string>`max(${schema.outreachMessages.envoyeAt})`.as("dernier"),
      })
      .from(schema.outreachMessages)
      .where(eq(schema.outreachMessages.tenantId, tenantId))
      .groupBy(schema.outreachMessages.profileId)
      .as("dernier_envoi");

    return tx
      .select({ id: schema.cvthequeProfiles.id })
      .from(schema.cvthequeProfiles)
      .leftJoin(dernierEnvoi, eq(dernierEnvoi.profileId, schema.cvthequeProfiles.id))
      .where(
        and(
          eq(schema.cvthequeProfiles.tenantId, tenantId),
          or(
            and(isNull(dernierEnvoi.dernier), lt(schema.cvthequeProfiles.createdAt, cutoff)),
            sql`${dernierEnvoi.dernier} < ${cutoffIso}::timestamptz`,
          ),
        ),
      );
  });
}

/** Profils à enrichir en priorité : les plus anciennement rafraîchis d'abord. */
export async function selectionnerProfilsAEnrichir(
  tenantId: string,
  limite: number,
  ancienneteMs: number,
): Promise<(typeof schema.cvthequeProfiles.$inferSelect)[]> {
  const seuil = new Date(Date.now() - ancienneteMs);
  return withTenant(tenantId, (tx) =>
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
      .limit(limite),
  );
}
