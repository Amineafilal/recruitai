import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { TenantContext } from "./tenant-context.js";

export const CurrentTenant = createParamDecorator((_data: unknown, ctx: ExecutionContext): TenantContext => {
  const request = ctx.switchToHttp().getRequest<{ tenantContext: TenantContext }>();
  return request.tenantContext;
});
