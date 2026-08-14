import { ForbiddenException } from "@nestjs/common";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { getAdminDb, schema } from "@recruitai/db";
import { PLAN_CONFIGS, type PlanId } from "@recruitai/types";

/**
 * Sièges occupés et disponibles d'une agence.
 *
 * `maxRecruiters` existait dans PLAN_CONFIGS sans être vérifié nulle part : une
 * formule Starter, limitée à 3, pouvait accueillir dix recruteurs. Comme pour
 * la limite de postes, ce n'est pas décoratif — c'est ce qui distingue les
 * formules les unes des autres.
 */
export interface EtatSieges {
  plan: PlanId;
  libelle: string;
  /** Comptes déjà créés. */
  membres: number;
  /** Invitations envoyées, ni acceptées ni expirées. */
  invitationsEnAttente: number;
  /** null = sans limite (formule Enterprise). */
  plafond: number | null;
}

/**
 * Les invitations en attente comptent comme des sièges pris.
 *
 * Sans elles, il suffirait d'envoyer dix invitations pour un seul siège
 * restant : chacune passerait le contrôle à l'envoi, et l'agence se
 * retrouverait avec dix personnes qui ont choisi leur mot de passe avant
 * d'être refusées. Réserver le siège dès l'envoi évite cette promesse qu'on ne
 * peut pas tenir.
 */
export async function etatSieges(tenantId: string): Promise<EtatSieges> {
  const db = getAdminDb();

  const [agence] = await db.select().from(schema.tenants).where(eq(schema.tenants.id, tenantId));
  const plan = (agence?.plan ?? "starter") as PlanId;

  const [membres] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.users)
    .where(eq(schema.users.tenantId, tenantId));

  const [attente] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.invitations)
    .where(
      and(
        eq(schema.invitations.tenantId, tenantId),
        isNull(schema.invitations.accepteAt),
        gt(schema.invitations.expiresAt, new Date()),
      ),
    );

  return {
    plan,
    libelle: PLAN_CONFIGS[plan].label,
    membres: membres?.n ?? 0,
    invitationsEnAttente: attente?.n ?? 0,
    plafond: PLAN_CONFIGS[plan].maxRecruiters,
  };
}

/**
 * Refuse une invitation de plus quand tous les sièges sont pris ou réservés.
 *
 * `exclureEmail` sert au renvoi d'invitation : réinviter quelqu'un qui a déjà
 * une invitation en attente REMPLACE son jeton, ça n'occupe pas un second
 * siège. Sans cette exclusion, renvoyer un lien à une personne qui ne l'a
 * jamais reçu échouerait dès que l'agence est pleine.
 */
export async function verifierQuotaInvitation(tenantId: string, exclureEmail?: string): Promise<void> {
  const etat = await etatSieges(tenantId);
  if (etat.plafond === null) return;

  let reserves = etat.invitationsEnAttente;
  if (exclureEmail) {
    const [dejaInvite] = await getAdminDb()
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.invitations)
      .where(
        and(
          eq(schema.invitations.tenantId, tenantId),
          eq(schema.invitations.email, exclureEmail.trim().toLowerCase()),
          isNull(schema.invitations.accepteAt),
          gt(schema.invitations.expiresAt, new Date()),
        ),
      );
    reserves -= dejaInvite?.n ?? 0;
  }

  const occupes = etat.membres + reserves;
  if (occupes < etat.plafond) return;

  // Le message distingue les comptes des invitations : « 3 sièges occupés »
  // laisserait chercher un quatrième recruteur qui n'existe pas encore.
  const detail =
    reserves > 0
      ? `${etat.membres} compte(s) et ${reserves} invitation(s) en attente`
      : `${etat.membres} compte(s)`;

  throw new ForbiddenException(
    `Votre formule ${etat.libelle} autorise ${etat.plafond} recruteur(s), et vous avez déjà ` +
      `${detail}. Retirez un accès ou annulez une invitation pour en inviter un autre, ou ` +
      `changez de formule depuis la page Abonnement.`,
  );
}

/**
 * Dernier contrôle, au moment où le compte est réellement créé.
 *
 * Indispensable même si l'envoi est déjà filtré : entre l'envoi et
 * l'acceptation, un siège peut avoir été pris autrement — une autre invitation
 * acceptée plus vite, ou une rétrogradation de formule. Refuser ici est
 * désagréable pour l'invité, mais moins que de livrer une agence au-dessus de
 * ce qu'elle paie.
 */
export async function verifierQuotaAcceptation(tenantId: string): Promise<void> {
  const etat = await etatSieges(tenantId);
  if (etat.plafond === null || etat.membres < etat.plafond) return;

  throw new ForbiddenException(
    `Cette agence a atteint le nombre de recruteurs autorisé par sa formule ` +
      `${etat.libelle} (${etat.plafond}). Demandez à son administrateur de libérer ` +
      `un accès ou de changer de formule.`,
  );
}
