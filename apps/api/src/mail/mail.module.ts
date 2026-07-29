import { Global, Module } from "@nestjs/common";
import { MailerService } from "./mailer.service.js";

/** Global : l'auth, l'équipe et les relances envoient tous des emails. */
@Global()
@Module({
  providers: [MailerService],
  exports: [MailerService],
})
export class MailModule {}
