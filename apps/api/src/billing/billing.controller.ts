import { Controller, Post, HttpCode } from "@nestjs/common";
import { Public } from "../tenant/public.decorator.js";

@Controller("billing")
export class BillingController {
  // TODO: vérifier la signature Stripe (stripe-signature header + webhook
  // secret) avant d'agir sur l'event — stub volontairement minimal tant que
  // l'intégration Stripe Billing (plans Starter/Growth/Scale) n'est pas
  // câblée. Ne pas déployer en l'état.
  @Public()
  @Post("webhook")
  @HttpCode(200)
  handleWebhook() {
    return { received: true };
  }
}
