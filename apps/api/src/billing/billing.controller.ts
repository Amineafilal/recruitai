import { Controller, Get, Post, HttpCode } from "@nestjs/common";
import { Public } from "../tenant/public.decorator.js";
import { CurrentTenant } from "../tenant/tenant.decorator.js";
import type { TenantContext } from "../tenant/tenant-context.js";
import { AbonnementService } from "./abonnement.service.js";

@Controller("billing")
export class BillingController {
  constructor(private readonly abonnement: AbonnementService) {}

  /** Plan actif, limites et consommation réelle de l'agence. */
  @Get("abonnement")
  etat(@CurrentTenant() tenant: TenantContext) {
    return this.abonnement.etat(tenant.tenantId);
  }

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
