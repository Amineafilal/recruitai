import { Module } from "@nestjs/common";
import { BillingController } from "./billing.controller.js";
import { AbonnementService } from "./abonnement.service.js";

@Module({
  controllers: [BillingController],
  providers: [AbonnementService],
})
export class BillingModule {}
