import { Body, Controller, Delete, Get, Param, Patch, Post, Put, BadRequestException } from "@nestjs/common";
import { z } from "zod";
import { CampaignInputSchema } from "@recruitai/types";
import { CurrentTenant } from "../tenant/tenant.decorator.js";
import type { TenantContext } from "../tenant/tenant-context.js";
import { CampaignsService } from "./campaigns.service.js";
import { OutreachRunner } from "../outreach/outreach.runner.js";

const StatusSchema = z.enum(["actif", "pause"]);

@Controller("campagnes")
export class CampaignsController {
  constructor(
    private readonly campaignsService: CampaignsService,
    private readonly outreach: OutreachRunner,
  ) {}

  @Get()
  list(@CurrentTenant() tenant: TenantContext) {
    return this.campaignsService.list(tenant.tenantId);
  }

  @Post()
  create(@CurrentTenant() tenant: TenantContext, @Body() body: unknown) {
    const parsed = CampaignInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.campaignsService.create(tenant.tenantId, parsed.data);
  }

  @Patch(":id/statut")
  setStatus(@CurrentTenant() tenant: TenantContext, @Param("id") id: string, @Body() body: unknown) {
    const parsed = StatusSchema.safeParse((body as { statut?: unknown })?.statut);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.campaignsService.setStatus(tenant.tenantId, id, parsed.data);
  }

  // Déclaré AVANT les routes paramétrées : sinon "messages" serait capturé
  // comme un :id par le routeur.
  @Get("messages")
  messages(@CurrentTenant() tenant: TenantContext) {
    return this.campaignsService.messages(tenant.tenantId);
  }

  @Put(":id")
  update(@CurrentTenant() tenant: TenantContext, @Param("id") id: string, @Body() body: unknown) {
    const parsed = CampaignInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.campaignsService.update(tenant.tenantId, id, parsed.data);
  }

  /** Envoi immédiat, sans attendre le cron de 09:00. */
  @Post(":id/envoyer")
  envoyer(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.outreach.envoyerCampagne(tenant.tenantId, id);
  }

  @Delete(":id")
  async remove(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    await this.campaignsService.remove(tenant.tenantId, id);
    return { ok: true };
  }
}
