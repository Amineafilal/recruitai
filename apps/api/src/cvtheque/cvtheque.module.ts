import { Module } from "@nestjs/common";
import { CvthequeController } from "./cvtheque.controller.js";
import { CvthequeService } from "./cvtheque.service.js";
import { CvthequeImportService } from "./cvtheque-import.service.js";
import { EnrichRunner } from "./enrich.runner.js";
import { SourcingModule } from "../sourcing/sourcing.module.js";

@Module({
  // Pour ApifyService, partagé avec le sourcing de postes.
  imports: [SourcingModule],
  controllers: [CvthequeController],
  providers: [CvthequeService, CvthequeImportService, EnrichRunner],
  exports: [EnrichRunner],
})
export class CvthequeModule {}
