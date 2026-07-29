import { Controller, Get, Post, Delete, Req, BadRequestException, ForbiddenException } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { CurrentTenant } from "../tenant/tenant.decorator.js";
import type { TenantContext } from "../tenant/tenant-context.js";
import { CvthequeService } from "./cvtheque.service.js";
import { CvthequeImportService } from "./cvtheque-import.service.js";

@Controller("cvtheque")
export class CvthequeController {
  constructor(
    private readonly cvthequeService: CvthequeService,
    private readonly importService: CvthequeImportService,
  ) {}

  private exigerAdmin(tenant: TenantContext): void {
    if (tenant.role !== "admin") {
      throw new ForbiddenException("Réservé aux administrateurs de l'agence.");
    }
  }

  @Get("chauds")
  hotProfiles(@CurrentTenant() tenant: TenantContext) {
    return this.cvthequeService.hotProfiles(tenant.tenantId);
  }

  @Get("profils")
  allProfiles(@CurrentTenant() tenant: TenantContext) {
    return this.cvthequeService.allProfiles(tenant.tenantId);
  }

  @Get("stats")
  stats(@CurrentTenant() tenant: TenantContext) {
    return this.cvthequeService.stats(tenant.tenantId);
  }

  /**
   * Jeu de démonstration. Réservé aux administrateurs : ces fiches
   * apparaissent dans la CVthèque de toute l'agence.
   */
  @Post("demo")
  chargerDemo(@CurrentTenant() tenant: TenantContext) {
    this.exigerAdmin(tenant);
    return this.cvthequeService.chargerDemo(tenant.tenantId);
  }

  @Delete("demo")
  supprimerDemo(@CurrentTenant() tenant: TenantContext) {
    this.exigerAdmin(tenant);
    return this.cvthequeService.supprimerDemo(tenant.tenantId);
  }

  /** Analyse le CSV sans rien écrire, pour confirmation par l'utilisateur. */
  @Post("import/apercu")
  async apercuCsv(@CurrentTenant() tenant: TenantContext, @Req() req: FastifyRequest) {
    const file = await req.file();
    if (!file) {
      throw new BadRequestException("Aucun fichier reçu (champ multipart attendu).");
    }
    return this.importService.analyserCsv(tenant.tenantId, file.file);
  }

  @Post("import")
  async importCsv(@CurrentTenant() tenant: TenantContext, @Req() req: FastifyRequest) {
    const file = await req.file();
    if (!file) {
      throw new BadRequestException("Aucun fichier reçu (champ multipart attendu).");
    }
    // Le fichier est consommé en streaming : une CVthèque de 50k lignes n'est
    // jamais chargée entièrement en mémoire.
    return this.importService.importCsv(tenant.tenantId, file.file);
  }
}
