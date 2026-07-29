import { Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { getAdminDb, withTenant, schema } from "@recruitai/db";

@Injectable()
export class OptOutService {
  /**
   * Traite un clic sur le lien de désinscription. La route est publique (le
   * candidat n'a évidemment pas de compte), donc le jeton est la seule
   * autorisation : il est aléatoire, non devinable, et ne révèle aucun
   * identifiant interne.
   *
   * Le lookup par jeton passe par getAdminDb() car on ne connaît pas encore
   * le tenant à ce stade — c'est le seul moyen de le résoudre. Toute
   * écriture qui suit est ensuite faite dans le contexte du tenant trouvé.
   */
  async optOutByToken(token: string): Promise<{ dejaDesinscrit: boolean }> {
    const [profil] = await getAdminDb()
      .select({
        id: schema.cvthequeProfiles.id,
        tenantId: schema.cvthequeProfiles.tenantId,
        dedupeKey: schema.cvthequeProfiles.dedupeKey,
      })
      .from(schema.cvthequeProfiles)
      .where(eq(schema.cvthequeProfiles.optOutToken, token));

    if (!profil) {
      throw new NotFoundException("Lien de désinscription invalide ou expiré.");
    }

    return withTenant(profil.tenantId, async (tx) => {
      const [existant] = await tx
        .select()
        .from(schema.consents)
        .where(
          and(
            eq(schema.consents.tenantId, profil.tenantId),
            eq(schema.consents.dedupeKey, profil.dedupeKey),
            eq(schema.consents.type, "opt_out"),
          ),
        );

      if (existant) {
        return { dejaDesinscrit: true };
      }

      await tx.insert(schema.consents).values({
        tenantId: profil.tenantId,
        candidateId: profil.id,
        dedupeKey: profil.dedupeKey,
        type: "opt_out",
        source: "lien_email",
      });

      // Retire immédiatement le profil du vivier de relance : l'opt-out ne
      // doit pas attendre le prochain cycle pour prendre effet.
      await tx
        .update(schema.cvthequeProfiles)
        .set({ statutChaud: false })
        .where(eq(schema.cvthequeProfiles.id, profil.id));

      await tx.insert(schema.auditLog).values({
        tenantId: profil.tenantId,
        action: `opt_out profil=${profil.id}`,
        acteur: "candidat:lien_email",
      });

      return { dejaDesinscrit: false };
    });
  }
}
