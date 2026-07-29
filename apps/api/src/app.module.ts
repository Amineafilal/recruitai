import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MailModule } from "./mail/mail.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { TenantModule } from "./tenant/tenant.module.js";
import { TeamModule } from "./team/team.module.js";
import { OutreachModule } from "./outreach/outreach.module.js";
import { SchedulerModule } from "./scheduler/scheduler.module.js";
import { ContactModule } from "./contact/contact.module.js";
import { JobsModule } from "./jobs/jobs.module.js";
import { SourcingModule } from "./sourcing/sourcing.module.js";
import { CvthequeModule } from "./cvtheque/cvtheque.module.js";
import { BillingModule } from "./billing/billing.module.js";
import { RgpdModule } from "./rgpd/rgpd.module.js";
import { CampaignsModule } from "./campaigns/campaigns.module.js";
import { DashboardModule } from "./dashboard/dashboard.module.js";
import { HealthController } from "./health.controller.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MailModule,
    AuthModule,
    TenantModule,
    TeamModule,
    JobsModule,
    SourcingModule,
    CvthequeModule,
    BillingModule,
    RgpdModule,
    CampaignsModule,
    OutreachModule,
    DashboardModule,
    SchedulerModule,
    ContactModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
