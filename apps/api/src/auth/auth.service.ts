import { Injectable, ConflictException, UnauthorizedException, BadRequestException, Logger } from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getAdminDb, schema } from "@recruitai/db";
import { MailerService } from "../mail/mailer.service.js";
import { verifierQuotaAcceptation } from "../team/quota-recruteurs.js";
import { genererToken, hashToken } from "./tokens.js";

export interface SessionUser {
  id: string;
  email: string;
  role: string;
  tenantId: string;
  agence: string;
}

interface JwtPayload {
  sub: string; // userId
  tid: string; // tenantId
  role: string;
}

/** Durée de validité d'un lien de réinitialisation. */
const RESET_TTL_MINUTES = 60;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly mailer: MailerService) {}

  private secret(): string {
    const s = process.env.AUTH_JWT_SECRET;
    if (!s) throw new Error("AUTH_JWT_SECRET is not set");
    return s;
  }

  sign(user: { id: string; tenantId: string; role: string }): string {
    const payload: JwtPayload = { sub: user.id, tid: user.tenantId, role: user.role };
    return jwt.sign(payload, this.secret(), { expiresIn: "30d" });
  }

  verify(token: string): { userId: string; tenantId: string; role: string } {
    const p = jwt.verify(token, this.secret()) as JwtPayload;
    return { userId: p.sub, tenantId: p.tid, role: p.role };
  }

  async signup(email: string, password: string, nomAgence: string): Promise<{ token: string; user: SessionUser }> {
    const db = getAdminDb();
    const normalized = email.trim().toLowerCase();

    const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, normalized));
    if (existing) {
      throw new ConflictException("Un compte existe déjà avec cet email.");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Une inscription crée l'agence ET son premier compte admin, d'un coup.
    const [tenant] = await db.insert(schema.tenants).values({ nom: nomAgence, plan: "starter" }).returning();
    const [user] = await db
      .insert(schema.users)
      .values({ tenantId: tenant.id, email: normalized, passwordHash, role: "admin" })
      .returning();

    const sessionUser: SessionUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: tenant.id,
      agence: tenant.nom,
    };
    return { token: this.sign({ id: user.id, tenantId: tenant.id, role: user.role }), user: sessionUser };
  }

  async login(email: string, password: string): Promise<{ token: string; user: SessionUser }> {
    const db = getAdminDb();
    const normalized = email.trim().toLowerCase();

    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, normalized));
    // Message volontairement générique (ne pas révéler si l'email existe).
    if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException("Email ou mot de passe incorrect.");
    }

    const [tenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.id, user.tenantId));

    const sessionUser: SessionUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      agence: tenant?.nom ?? "",
    };
    return { token: this.sign({ id: user.id, tenantId: user.tenantId, role: user.role }), user: sessionUser };
  }

  /**
   * Étape 1 du « mot de passe oublié ».
   *
   * Ne signale JAMAIS si l'email existe : la réponse est identique dans tous
   * les cas. Sinon ce formulaire public deviendrait un moyen de vérifier
   * quelles agences sont clientes, et quels recruteurs y travaillent.
   */
  async demanderReinitialisation(email: string): Promise<void> {
    const db = getAdminDb();
    const normalized = email.trim().toLowerCase();
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, normalized));
    if (!user) {
      this.logger.log(`Demande de réinitialisation pour un email inconnu — ignorée silencieusement.`);
      return;
    }

    const token = genererToken();
    const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000);

    // Les demandes précédentes encore actives sont invalidées : sinon un
    // ancien lien resté dans une boîte mail resterait utilisable.
    await db
      .update(schema.passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(schema.passwordResetTokens.userId, user.id), isNull(schema.passwordResetTokens.usedAt)));

    await db.insert(schema.passwordResetTokens).values({
      tenantId: user.tenantId,
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt,
    });

    const url = `${this.mailer.appUrl()}/reinitialiser-mot-de-passe?token=${token}`;
    await this.mailer.send({
      to: user.email,
      subject: "Réinitialiser votre mot de passe RecruitAI",
      html: this.mailer.gabarit(
        "Réinitialisation de votre mot de passe",
        `<p>Vous avez demandé à réinitialiser le mot de passe du compte <strong>${user.email}</strong>.</p>
         <p>Ce lien est valable ${RESET_TTL_MINUTES} minutes et ne fonctionne qu'une fois.</p>
         <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe reste inchangé.</p>`,
        { libelle: "Choisir un nouveau mot de passe", url },
      ),
    });
  }

  /** Étape 2 : le jeton est consommé et le mot de passe remplacé. */
  async reinitialiser(token: string, nouveauMotDePasse: string): Promise<void> {
    const db = getAdminDb();
    const [ligne] = await db
      .select()
      .from(schema.passwordResetTokens)
      .where(eq(schema.passwordResetTokens.tokenHash, hashToken(token)));

    if (!ligne || ligne.usedAt || ligne.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException("Ce lien est invalide ou a expiré. Refaites une demande.");
    }

    const passwordHash = await bcrypt.hash(nouveauMotDePasse, 10);
    await db.update(schema.users).set({ passwordHash }).where(eq(schema.users.id, ligne.userId));
    await db
      .update(schema.passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(schema.passwordResetTokens.id, ligne.id));

    await db.insert(schema.auditLog).values({
      tenantId: ligne.tenantId,
      action: `mot_de_passe_reinitialise user=${ligne.userId}`,
      acteur: "api:auth",
    });
  }

  /**
   * Détails d'une invitation, pour afficher « Rejoignez l'agence X » avant
   * que la personne ne crée son mot de passe. Public : le jeton fait office
   * d'authentification.
   */
  async consulterInvitation(token: string): Promise<{ email: string; agence: string; role: string }> {
    const db = getAdminDb();
    const [invit] = await db
      .select()
      .from(schema.invitations)
      .where(eq(schema.invitations.tokenHash, hashToken(token)));

    if (!invit || invit.accepteAt || invit.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException("Cette invitation est invalide, expirée ou déjà utilisée.");
    }
    const [tenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.id, invit.tenantId));
    return { email: invit.email, agence: tenant?.nom ?? "", role: invit.role };
  }

  /**
   * Acceptation d'une invitation : crée le compte DANS l'agence qui a invité.
   * C'est la seule façon de rejoindre un tenant existant — l'inscription
   * classique, elle, crée toujours une nouvelle agence.
   */
  async accepterInvitation(token: string, motDePasse: string): Promise<{ token: string; user: SessionUser }> {
    const db = getAdminDb();
    const tokenHash = hashToken(token);
    const [invit] = await db.select().from(schema.invitations).where(eq(schema.invitations.tokenHash, tokenHash));

    if (!invit || invit.accepteAt || invit.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException("Cette invitation est invalide, expirée ou déjà utilisée.");
    }

    const [existant] = await db.select().from(schema.users).where(eq(schema.users.email, invit.email));
    if (existant) {
      throw new ConflictException("Un compte existe déjà avec cet email. Connectez-vous.");
    }

    // Contrôle final, même si l'envoi de l'invitation était déjà filtré :
    // entre l'envoi et l'acceptation, un siège a pu être pris autrement — une
    // autre invitation acceptée plus vite, ou une formule rétrogradée.
    await verifierQuotaAcceptation(invit.tenantId);

    const passwordHash = await bcrypt.hash(motDePasse, 10);
    const [user] = await db
      .insert(schema.users)
      .values({ tenantId: invit.tenantId, email: invit.email, passwordHash, role: invit.role })
      .returning();

    await db
      .update(schema.invitations)
      .set({ accepteAt: new Date() })
      .where(eq(schema.invitations.id, invit.id));
    await db.insert(schema.auditLog).values({
      tenantId: invit.tenantId,
      action: `invitation_acceptee email=${invit.email} role=${invit.role}`,
      acteur: "api:auth",
    });

    const [tenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.id, invit.tenantId));
    const sessionUser: SessionUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      agence: tenant?.nom ?? "",
    };
    return { token: this.sign({ id: user.id, tenantId: user.tenantId, role: user.role }), user: sessionUser };
  }

  /**
   * Changement de mot de passe par un utilisateur connecté.
   *
   * L'ancien mot de passe est exigé même si la session est valide : sans ça,
   * un poste laissé déverrouillé quelques minutes suffirait à verrouiller le
   * propriétaire hors de son propre compte.
   */
  async changerMotDePasse(userId: string, ancien: string, nouveau: string): Promise<void> {
    const db = getAdminDb();
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    if (!user?.passwordHash) throw new UnauthorizedException("Compte introuvable.");

    if (!(await bcrypt.compare(ancien, user.passwordHash))) {
      throw new BadRequestException("Le mot de passe actuel est incorrect.");
    }
    if (ancien === nouveau) {
      throw new BadRequestException("Le nouveau mot de passe doit être différent de l'actuel.");
    }

    await db
      .update(schema.users)
      .set({ passwordHash: await bcrypt.hash(nouveau, 10) })
      .where(eq(schema.users.id, userId));

    // Les demandes de réinitialisation en cours sont invalidées : après un
    // changement volontaire, un vieux lien reçu par email ne doit plus ouvrir
    // le compte.
    await db
      .update(schema.passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(schema.passwordResetTokens.userId, userId), isNull(schema.passwordResetTokens.usedAt)));

    await db.insert(schema.auditLog).values({
      tenantId: user.tenantId,
      action: `mot_de_passe_change user=${userId}`,
      acteur: `api:user:${userId}`,
    });
  }

  /** Renommage de l'agence. Réservé aux administrateurs (contrôlé au controller). */
  async renommerAgence(tenantId: string, userId: string, nom: string): Promise<{ agence: string }> {
    const db = getAdminDb();
    const [tenant] = await db
      .update(schema.tenants)
      .set({ nom })
      .where(eq(schema.tenants.id, tenantId))
      .returning();
    await db.insert(schema.auditLog).values({
      tenantId,
      action: `agence_renommee nom=${nom}`,
      acteur: `api:user:${userId}`,
    });
    return { agence: tenant.nom };
  }

  async me(userId: string): Promise<SessionUser | null> {
    const db = getAdminDb();
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    if (!user) return null;
    const [tenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.id, user.tenantId));
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      agence: tenant?.nom ?? "",
    };
  }
}
