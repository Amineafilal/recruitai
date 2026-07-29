import { Injectable, Logger } from "@nestjs/common";
import { eq, and } from "drizzle-orm";
import { getAdminDb, schema } from "@recruitai/db";
import type {
  ClerkWebhookEvent,
  OrganizationData,
  OrganizationMembershipData,
} from "./clerk-events.js";

/**
 * Provisioning déclenché par les webhooks Clerk. Utilise getAdminDb() (bypass
 * RLS) car ces événements n'ont pas de contexte tenant applicatif : c'est
 * précisément ici qu'on crée la ligne tenants qui rendra RLS opérant ensuite.
 *
 * Toutes les opérations sont idempotentes : Clerk peut réémettre un événement
 * (retries), et l'ordre d'arrivée n'est pas garanti.
 */
@Injectable()
export class ClerkWebhookService {
  private readonly logger = new Logger(ClerkWebhookService.name);

  async handle(event: ClerkWebhookEvent): Promise<void> {
    switch (event.type) {
      case "organization.created":
      case "organization.updated":
        return this.upsertTenant(event.data as unknown as OrganizationData);
      case "organization.deleted":
        return this.deleteTenant(event.data as unknown as { id: string });
      case "organizationMembership.created":
      case "organizationMembership.updated":
        return this.upsertUser(event.data as unknown as OrganizationMembershipData);
      case "organizationMembership.deleted":
        return this.deleteUser(event.data as unknown as OrganizationMembershipData);
      default:
        this.logger.debug(`Événement Clerk ignoré : ${event.type}`);
    }
  }

  private async upsertTenant(org: OrganizationData): Promise<void> {
    const db = getAdminDb();
    await db
      .insert(schema.tenants)
      .values({ clerkOrgId: org.id, nom: org.name, plan: "starter" })
      .onConflictDoUpdate({
        target: schema.tenants.clerkOrgId,
        set: { nom: org.name },
      });
    this.logger.log(`Tenant provisionné pour l'organisation Clerk ${org.id}`);
  }

  private async deleteTenant(data: { id: string }): Promise<void> {
    const db = getAdminDb();
    // La cascade sur tenant_id supprime users, jobs, cvthèque, etc.
    await db.delete(schema.tenants).where(eq(schema.tenants.clerkOrgId, data.id));
    this.logger.log(`Tenant supprimé pour l'organisation Clerk ${data.id}`);
  }

  private async upsertUser(membership: OrganizationMembershipData): Promise<void> {
    const db = getAdminDb();
    const [tenant] = await db
      .select({ id: schema.tenants.id })
      .from(schema.tenants)
      .where(eq(schema.tenants.clerkOrgId, membership.organization.id));

    if (!tenant) {
      // membership.created peut précéder organization.created dans l'ordre de
      // livraison. On lève pour que Clerk réessaie plus tard (retry Svix).
      throw new Error(
        `Tenant introuvable pour l'organisation ${membership.organization.id} — membership rejoué ultérieurement`,
      );
    }

    const role = membership.role.includes("admin") ? "admin" : "recruteur";
    const clerkUserId = membership.public_user_data.user_id;

    await db
      .insert(schema.users)
      .values({
        tenantId: tenant.id,
        clerkUserId,
        email: membership.public_user_data.identifier,
        role,
      })
      .onConflictDoNothing();
    this.logger.log(`Utilisateur ${clerkUserId} provisionné pour le tenant ${tenant.id}`);
  }

  private async deleteUser(membership: OrganizationMembershipData): Promise<void> {
    const db = getAdminDb();
    const [tenant] = await db
      .select({ id: schema.tenants.id })
      .from(schema.tenants)
      .where(eq(schema.tenants.clerkOrgId, membership.organization.id));
    if (!tenant) return;

    await db
      .delete(schema.users)
      .where(
        and(
          eq(schema.users.tenantId, tenant.id),
          eq(schema.users.clerkUserId, membership.public_user_data.user_id),
        ),
      );
    this.logger.log(`Utilisateur ${membership.public_user_data.user_id} retiré du tenant ${tenant.id}`);
  }
}
