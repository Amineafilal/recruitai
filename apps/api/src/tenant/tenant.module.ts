import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { TenantGuard } from "./tenant.guard.js";
import { AuthModule } from "../auth/auth.module.js";

@Module({
  imports: [AuthModule],
  providers: [{ provide: APP_GUARD, useClass: TenantGuard }],
})
export class TenantModule {}
