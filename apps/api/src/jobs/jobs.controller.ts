import { Body, Controller, Delete, Get, Param, Patch, Post, Put, BadRequestException } from "@nestjs/common";
import { JobCriteriaSchema, JobStatus } from "@recruitai/types";
import { CurrentTenant } from "../tenant/tenant.decorator.js";
import type { TenantContext } from "../tenant/tenant-context.js";
import { JobsService } from "./jobs.service.js";

@Controller("jobs")
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  list(@CurrentTenant() tenant: TenantContext) {
    return this.jobsService.list(tenant.tenantId);
  }

  @Post()
  create(@CurrentTenant() tenant: TenantContext, @Body() body: unknown) {
    const parsed = JobCriteriaSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.jobsService.create(tenant.tenantId, parsed.data);
  }

  @Get(":id")
  get(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    return this.jobsService.get(tenant.tenantId, id);
  }

  @Patch(":id/statut")
  updateStatus(@CurrentTenant() tenant: TenantContext, @Param("id") id: string, @Body() body: unknown) {
    const parsed = JobStatus.safeParse((body as { statut?: unknown })?.statut);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.jobsService.updateStatus(tenant.tenantId, id, parsed.data);
  }

  @Put(":id")
  update(@CurrentTenant() tenant: TenantContext, @Param("id") id: string, @Body() body: unknown) {
    const parsed = JobCriteriaSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.jobsService.update(tenant.tenantId, id, parsed.data);
  }

  @Post(":id/relancer")
  relancer(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    this.jobsService.relancerSourcing(tenant.tenantId, id);
    return { ok: true };
  }

  @Delete(":id")
  async remove(@CurrentTenant() tenant: TenantContext, @Param("id") id: string) {
    await this.jobsService.remove(tenant.tenantId, id);
    return { ok: true };
  }
}
