import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { SourcingModule } from "../sourcing/sourcing.module.js";
import { OutreachModule } from "../outreach/outreach.module.js";
import { RgpdModule } from "../rgpd/rgpd.module.js";
import { CvthequeModule } from "../cvtheque/cvtheque.module.js";
import { SchedulerService } from "./scheduler.service.js";
import { SchedulerController } from "./scheduler.controller.js";

@Module({
  imports: [ScheduleModule.forRoot(), SourcingModule, OutreachModule, RgpdModule, CvthequeModule],
  controllers: [SchedulerController],
  providers: [SchedulerService],
})
export class SchedulerModule {}
