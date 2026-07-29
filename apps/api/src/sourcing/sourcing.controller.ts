import { Controller, Get, Param, Patch, Post, Delete, Body, BadRequestException } from "@nestjs/common";
import { z } from "zod";
import { PipelineStage, ValidationStatus } from "@recruitai/types";
import { CurrentTenant } from "../tenant/tenant.decorator.js";
import type { TenantContext } from "../tenant/tenant-context.js";
import { SourcingService } from "./sourcing.service.js";

const NoteSchema = z.object({
  contenu: z.string().trim().min(1, "La note ne peut pas être vide.").max(4000),
});

const AppelSchema = z.object({
  resume: z.string().trim().min(1, "Indiquez l'issue de l'appel.").max(200),
  details: z.string().trim().max(4000).optional(),
});

const EtapeSchema = z.object({
  etape: PipelineStage,
  commentaire: z.string().trim().max(1000).optional(),
});

@Controller()
export class SourcingController {
  constructor(private readonly sourcingService: SourcingService) {}

  @Get("jobs/:jobId/shortlist")
  shortlist(@CurrentTenant() tenant: TenantContext, @Param("jobId") jobId: string) {
    return this.sourcingService.shortlist(tenant.tenantId, jobId);
  }

  @Get("candidates/:id")
  candidat(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.sourcingService.candidat(tenant.tenantId, id);
  }

  @Patch("candidates/:id/validation")
  setValidation(@CurrentTenant() tenant: TenantContext, @Param("id") id: string, @Body() body: unknown) {
    const parsed = ValidationStatus.safeParse((body as { statut?: unknown })?.statut);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.sourcingService.setValidation(tenant.tenantId, id, parsed.data);
  }

  @Patch("candidates/:id/etape")
  deplacerEtape(@CurrentTenant() tenant: TenantContext, @Param("id") id: string, @Body() body: unknown) {
    const parsed = EtapeSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.sourcingService.deplacerEtape(
      tenant.tenantId,
      id,
      parsed.data.etape,
      tenant.userId,
      parsed.data.commentaire,
    );
  }

  @Get("candidates/:id/timeline")
  timeline(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.sourcingService.timeline(tenant.tenantId, id);
  }

  @Post("candidates/:id/appels")
  loggerAppel(@CurrentTenant() tenant: TenantContext, @Param("id") id: string, @Body() body: unknown) {
    const parsed = AppelSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.sourcingService.loggerAppel(
      tenant.tenantId,
      id,
      tenant.userId,
      parsed.data.resume,
      parsed.data.details,
    );
  }

  @Get("candidates/:id/historique")
  historique(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.sourcingService.historique(tenant.tenantId, id);
  }

  @Post("candidates/:id/notes")
  ajouterNote(@CurrentTenant() tenant: TenantContext, @Param("id") id: string, @Body() body: unknown) {
    const parsed = NoteSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.sourcingService.ajouterNote(tenant.tenantId, id, tenant.userId, parsed.data.contenu);
  }

  @Delete("notes/:noteId")
  async supprimerNote(@CurrentTenant() tenant: TenantContext, @Param("noteId") noteId: string) {
    await this.sourcingService.supprimerNote(tenant.tenantId, noteId, {
      userId: tenant.userId,
      role: tenant.role,
    });
    return { ok: true };
  }
}
