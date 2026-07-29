import { Module } from "@nestjs/common";
import { CampaignsController } from "./campaigns.controller.js";
import { CampaignsService } from "./campaigns.service.js";
import { OutreachModule } from "../outreach/outreach.module.js";

@Module({
  imports: [OutreachModule],
  controllers: [CampaignsController],
  providers: [CampaignsService],
})
export class CampaignsModule {}
