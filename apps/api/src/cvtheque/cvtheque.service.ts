import { Injectable } from "@nestjs/common";
import { and, eq, desc, sql } from "drizzle-orm";
import { withTenant, schema } from "@recruitai/db";
import { PROFILS_DEMO } from "./demo-data.js";

@Injectable()
export class CvthequeService {
  async hotProfiles(tenantId: string) {
    return withTenant(tenantId, (tx) =>
      tx
        .select()
        .from(schema.cvthequeProfiles)
        .where(and(eq(schema.cvthequeProfiles.tenantId, tenantId), eq(schema.cvthequeProfiles.statutChaud, true)))
        .orderBy(desc(schema.cvthequeProfiles.dernierEnrichissementAt)),
    );
  }

  /** Tous les profils (les plus récents d'abord), pour la vue CVthèque. */
  async allProfiles(tenantId: string, limit = 100) {
    return withTenant(tenantId, (tx) =>
      tx
        .select()
        .from(schema.cvthequeProfiles)
        .where(eq(schema.cvthequeProfiles.tenantId, tenantId))
        .orderBy(desc(schema.cvthequeProfiles.createdAt))
        .limit(limit),
    );
  }

  /**
   * Charge le jeu de démonstration.
   *
   * Les fiches sont marquées `contact.demo = true` et leur clé de
   * dédoublonnage est préfixée : elles ne peuvent donc pas entrer en collision
   * avec un vrai contact importé, ni être confondues avec lui au moment de la
   * suppression.
   */
  async chargerDemo(tenantId: string): Promise<{ profils: number; signaux: number }> {
    return withTenant(tenantId, async (tx) => {
      let profils = 0;
      let signaux = 0;

      for (const p of PROFILS_DEMO) {
        const dedupeKey = `demo:${String(p.contact.prenom)}-${String(p.contact.nom)}`.toLowerCase();
        const [fiche] = await tx
          .insert(schema.cvthequeProfiles)
          .values({
            tenantId,
            contact: p.contact,
            dedupeKey,
            statutChaud: p.statutChaud,
            prioriteScore: p.prioriteScore,
            dernierEnrichissementAt:
              p.enrichiIlYaJours !== undefined
                ? new Date(Date.now() - p.enrichiIlYaJours * 24 * 60 * 60 * 1000)
                : null,
          })
          .onConflictDoNothing()
          .returning({ id: schema.cvthequeProfiles.id });

        // onConflictDoNothing : si la démo est déjà chargée, on ne duplique pas.
        if (!fiche) continue;
        profils += 1;

        if (p.signal) {
          await tx.insert(schema.signals).values({
            tenantId,
            profileId: fiche.id,
            type: p.signal,
          });
          signaux += 1;
        }
      }

      await tx.insert(schema.auditLog).values({
        tenantId,
        action: `cvtheque_demo_chargee profils=${profils}`,
        acteur: "api:demo",
      });

      return { profils, signaux };
    });
  }

  /**
   * Retire UNIQUEMENT les fiches de démonstration.
   *
   * Le filtre porte sur le marqueur `contact->>'demo'`, jamais sur autre chose :
   * un contact réel importé par l'agence ne doit en aucun cas pouvoir être
   * supprimé par ce bouton.
   */
  async supprimerDemo(tenantId: string): Promise<{ supprimes: number }> {
    return withTenant(tenantId, async (tx) => {
      const supprimees = await tx
        .delete(schema.cvthequeProfiles)
        .where(
          and(
            eq(schema.cvthequeProfiles.tenantId, tenantId),
            sql`${schema.cvthequeProfiles.contact}->>'demo' = 'true'`,
          ),
        )
        .returning({ id: schema.cvthequeProfiles.id });

      await tx.insert(schema.auditLog).values({
        tenantId,
        action: `cvtheque_demo_supprimee profils=${supprimees.length}`,
        acteur: "api:demo",
      });

      return { supprimes: supprimees.length };
    });
  }

  /** Compteurs pour les tuiles de stats. */
  async stats(tenantId: string) {
    return withTenant(tenantId, async (tx) => {
      const [row] = await tx
        .select({
          total: sql<number>`count(*)::int`,
          chauds: sql<number>`count(*) filter (where ${schema.cvthequeProfiles.statutChaud})::int`,
          avecEmail: sql<number>`count(*) filter (where ${schema.cvthequeProfiles.contact} ->> 'email' is not null)::int`,
          // Permet à l'interface de proposer « retirer la démo » plutôt que
          // « charger la démo » quand elle est déjà en place.
          demo: sql<number>`count(*) filter (where ${schema.cvthequeProfiles.contact} ->> 'demo' = 'true')::int`,
        })
        .from(schema.cvthequeProfiles)
        .where(eq(schema.cvthequeProfiles.tenantId, tenantId));
      return row ?? { total: 0, chauds: 0, avecEmail: 0, demo: 0 };
    });
  }
}
