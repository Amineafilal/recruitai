import { Injectable, Logger, BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getAdminDb, withTenant, schema } from "@recruitai/db";
import type { UserRole } from "@recruitai/types";
import { MailerService } from "../mail/mailer.service.js";
import { genererToken, hashToken } from "../auth/tokens.js";
import { verifierQuotaInvitation } from "./quota-recruteurs.js";

/** Une invitation reste valable une semaine. */
const INVITATION_TTL_JOURS = 7;

/**
 * Traduit l'erreur brute du fournisseur en une phrase utile à l'écran. Le cas
 * le plus fréquent en développement : Resend en mode test n'autorise l'envoi
 * qu'à l'adresse propriétaire du compte tant qu'aucun domaine n'est vérifié.
 */
function resumeErreurEnvoi(err: unknown): string {
  const brut = String(err);
  if (brut.includes("testing emails") || brut.includes("verify a domain")) {
    return "Resend est en mode test : il ne délivre qu'à l'adresse propriétaire du compte tant qu'un domaine n'est pas vérifié.";
  }
  return "L'email n'a pas pu être envoyé.";
}

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

  constructor(private readonly mailer: MailerService) {}

  /** Membres de l'agence. Le hash de mot de passe n'est jamais exposé. */
  async membres(tenantId: string) {
    return withTenant(tenantId, (tx) =>
      tx
        .select({
          id: schema.users.id,
          email: schema.users.email,
          role: schema.users.role,
          createdAt: schema.users.createdAt,
        })
        .from(schema.users)
        .where(eq(schema.users.tenantId, tenantId))
        .orderBy(desc(schema.users.createdAt)),
    );
  }

  /** Invitations encore en attente (ni acceptées, ni révoquées). */
  async invitationsEnAttente(tenantId: string) {
    return withTenant(tenantId, (tx) =>
      tx
        .select({
          id: schema.invitations.id,
          email: schema.invitations.email,
          role: schema.invitations.role,
          expiresAt: schema.invitations.expiresAt,
          createdAt: schema.invitations.createdAt,
        })
        .from(schema.invitations)
        .where(and(eq(schema.invitations.tenantId, tenantId), isNull(schema.invitations.accepteAt)))
        .orderBy(desc(schema.invitations.createdAt)),
    );
  }

  async inviter(
    tenantId: string,
    invitantUserId: string,
    email: string,
    role: UserRole,
  ): Promise<{ email: string; lien: string | null; envoye: boolean; raison?: string }> {
    const normalized = email.trim().toLowerCase();
    const db = getAdminDb();

    // Contrôlé AVANT l'envoi : découvrir la limite après avoir reçu un lien et
    // choisi un mot de passe serait une promesse qu'on ne peut pas tenir.
    // L'email est exclu du décompte car réinviter quelqu'un remplace son jeton
    // au lieu d'occuper un second siège.
    await verifierQuotaInvitation(tenantId, normalized);

    // Vérification cross-tenant volontaire : un email ne peut appartenir qu'à
    // une seule agence (users_email_unique_idx est global). Sans ce contrôle,
    // l'invitation partirait et échouerait seulement à l'acceptation, après
    // que la personne ait choisi son mot de passe.
    const [existant] = await db.select().from(schema.users).where(eq(schema.users.email, normalized));
    if (existant) {
      throw new ConflictException(
        existant.tenantId === tenantId
          ? "Cette personne fait déjà partie de votre équipe."
          : "Cet email est déjà rattaché à un autre compte RecruitAI.",
      );
    }

    const token = genererToken();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_JOURS * 24 * 60 * 60 * 1000);

    const [tenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.id, tenantId));

    await withTenant(tenantId, async (tx) => {
      // Une invitation en attente pour ce même email est remplacée : on
      // renvoie un lien neuf plutôt que d'empiler des jetons valides.
      await tx
        .delete(schema.invitations)
        .where(
          and(
            eq(schema.invitations.tenantId, tenantId),
            eq(schema.invitations.email, normalized),
            isNull(schema.invitations.accepteAt),
          ),
        );
      await tx.insert(schema.invitations).values({
        tenantId,
        email: normalized,
        role,
        tokenHash: hashToken(token),
        inviteParUserId: invitantUserId,
        expiresAt,
      });
      await tx.insert(schema.auditLog).values({
        tenantId,
        action: `invitation_envoyee email=${normalized} role=${role}`,
        acteur: `api:user:${invitantUserId}`,
      });
    });

    const lien = `${this.mailer.appUrl()}/invitation/${token}`;

    // L'envoi est tenté APRÈS la création de l'invitation, et son échec n'est
    // pas fatal : l'invitation existe et reste valable. Si l'email ne part
    // pas (clé absente, domaine non vérifié, quota du fournisseur), on rend
    // le lien à l'administrateur pour qu'il le transmette lui-même — sans ça
    // le jeton serait perdu et l'invitation inutilisable.
    try {
      const { providerMessageId } = await this.mailer.send({
        to: normalized,
        subject: `Rejoignez ${tenant?.nom ?? "votre agence"} sur RecruitAI`,
        html: this.mailer.gabarit(
          `Rejoignez ${tenant?.nom ?? "votre agence"}`,
          `<p>Vous avez été invité·e à rejoindre l'espace RecruitAI de <strong>${tenant?.nom ?? "votre agence"}</strong> en tant que ${role}.</p>
           <p>Créez votre mot de passe pour accéder aux postes, aux shortlists et à la CVthèque de l'agence.</p>
           <p>Cette invitation expire dans ${INVITATION_TTL_JOURS} jours.</p>`,
          { libelle: "Rejoindre l'agence", url: lien },
        ),
      });

      // providerMessageId null = aucune clé configurée : l'email n'est pas
      // parti, on expose le lien. Sinon l'envoi a réussi et le lien reste privé.
      if (!providerMessageId) {
        return { email: normalized, lien, envoye: false, raison: "Aucune clé d'envoi d'email configurée." };
      }
      return { email: normalized, lien: null, envoye: true };
    } catch (err) {
      this.logger.warn(`Envoi de l'invitation à ${normalized} échoué : ${String(err)}`);
      return {
        email: normalized,
        lien,
        envoye: false,
        raison: resumeErreurEnvoi(err),
      };
    }
  }

  async revoquer(tenantId: string, invitationId: string): Promise<void> {
    await withTenant(tenantId, async (tx) => {
      const [supprimee] = await tx
        .delete(schema.invitations)
        .where(and(eq(schema.invitations.id, invitationId), isNull(schema.invitations.accepteAt)))
        .returning();
      if (!supprimee) throw new NotFoundException("Invitation introuvable ou déjà acceptée.");
      await tx.insert(schema.auditLog).values({
        tenantId,
        action: `invitation_revoquee email=${supprimee.email}`,
        acteur: "api:team",
      });
    });
  }

  /**
   * Retrait d'un membre. Un admin ne peut pas se retirer lui-même, et la
   * dernière personne admin ne peut pas être retirée : sinon l'agence se
   * retrouverait sans personne capable d'inviter ou de gérer l'équipe.
   */
  async retirerMembre(tenantId: string, acteurUserId: string, membreId: string): Promise<void> {
    if (acteurUserId === membreId) {
      throw new BadRequestException("Vous ne pouvez pas retirer votre propre compte.");
    }
    await withTenant(tenantId, async (tx) => {
      const membres = await tx.select().from(schema.users).where(eq(schema.users.tenantId, tenantId));
      const cible = membres.find((m) => m.id === membreId);
      if (!cible) throw new NotFoundException("Membre introuvable.");

      const admins = membres.filter((m) => m.role === "admin");
      if (cible.role === "admin" && admins.length <= 1) {
        throw new BadRequestException("L'agence doit conserver au moins un administrateur.");
      }

      await tx.delete(schema.users).where(eq(schema.users.id, membreId));
      await tx.insert(schema.auditLog).values({
        tenantId,
        action: `membre_retire email=${cible.email}`,
        acteur: `api:user:${acteurUserId}`,
      });
    });
  }

  async changerRole(tenantId: string, acteurUserId: string, membreId: string, role: UserRole): Promise<void> {
    await withTenant(tenantId, async (tx) => {
      const membres = await tx.select().from(schema.users).where(eq(schema.users.tenantId, tenantId));
      const cible = membres.find((m) => m.id === membreId);
      if (!cible) throw new NotFoundException("Membre introuvable.");

      const admins = membres.filter((m) => m.role === "admin");
      if (cible.role === "admin" && role !== "admin" && admins.length <= 1) {
        throw new BadRequestException("L'agence doit conserver au moins un administrateur.");
      }

      await tx.update(schema.users).set({ role }).where(eq(schema.users.id, membreId));
      await tx.insert(schema.auditLog).values({
        tenantId,
        action: `role_modifie email=${cible.email} role=${role}`,
        acteur: `api:user:${acteurUserId}`,
      });
    });
  }
}
