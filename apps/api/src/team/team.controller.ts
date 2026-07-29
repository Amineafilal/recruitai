import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { z } from "zod";
import { CurrentTenant } from "../tenant/tenant.decorator.js";
import type { TenantContext } from "../tenant/tenant-context.js";
import { TeamService } from "./team.service.js";

const InviterSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "recruteur"]).default("recruteur"),
});
const RoleSchema = z.object({ role: z.enum(["admin", "recruteur"]) });

@Controller("equipe")
export class TeamController {
  constructor(private readonly team: TeamService) {}

  /**
   * Inviter, révoquer, retirer ou changer un rôle modifie qui accède aux
   * données de l'agence : réservé aux administrateurs. La lecture de la liste
   * reste ouverte à tous les membres.
   */
  private exigerAdmin(tenant: TenantContext): void {
    if (tenant.role !== "admin") {
      throw new ForbiddenException("Réservé aux administrateurs de l'agence.");
    }
  }

  @Get()
  async membres(@CurrentTenant() tenant: TenantContext) {
    const [membres, invitations] = await Promise.all([
      this.team.membres(tenant.tenantId),
      this.team.invitationsEnAttente(tenant.tenantId),
    ]);
    return { membres, invitations, moi: tenant.userId };
  }

  @Post("invitations")
  async inviter(@CurrentTenant() tenant: TenantContext, @Body() body: unknown) {
    this.exigerAdmin(tenant);
    const parsed = InviterSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.team.inviter(tenant.tenantId, tenant.userId, parsed.data.email, parsed.data.role);
  }

  @Delete("invitations/:id")
  async revoquer(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    this.exigerAdmin(tenant);
    await this.team.revoquer(tenant.tenantId, id);
    return { ok: true };
  }

  @Delete("membres/:id")
  async retirer(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    this.exigerAdmin(tenant);
    await this.team.retirerMembre(tenant.tenantId, tenant.userId, id);
    return { ok: true };
  }

  @Patch("membres/:id")
  async changerRole(
    @CurrentTenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    this.exigerAdmin(tenant);
    const parsed = RoleSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    await this.team.changerRole(tenant.tenantId, tenant.userId, id, parsed.data.role);
    return { ok: true };
  }
}
