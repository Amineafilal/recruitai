import { Controller, Get } from "@nestjs/common";
import { CurrentTenant } from "../tenant/tenant.decorator.js";
import type { TenantContext } from "../tenant/tenant-context.js";
import { DashboardService } from "./dashboard.service.js";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  data(@CurrentTenant() tenant: TenantContext) {
    return this.dashboardService.data(tenant.tenantId);
  }
}
