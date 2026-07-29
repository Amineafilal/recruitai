import { Module } from "@nestjs/common";
import { SourcingController } from "./sourcing.controller.js";
import { SourcingService } from "./sourcing.service.js";
import { SourcingRunner } from "./sourcing-runner.js";
import { ApifyService } from "./apify.service.js";

@Module({
  controllers: [SourcingController],
  providers: [SourcingService, SourcingRunner, ApifyService],
  // SourcingRunner : JobsModule (création de poste) et SchedulerModule.
  // ApifyService : partagé avec l'enrichissement CVthèque.
  exports: [SourcingRunner, ApifyService],
})
export class SourcingModule {}
