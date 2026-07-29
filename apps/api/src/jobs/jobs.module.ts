import { Module } from "@nestjs/common";
import { JobsController } from "./jobs.controller.js";
import { JobsService } from "./jobs.service.js";
import { SourcingModule } from "../sourcing/sourcing.module.js";

@Module({
  imports: [SourcingModule],
  controllers: [JobsController],
  providers: [JobsService],
})
export class JobsModule {}
