import { Controller, Post, Req, BadRequestException, UnauthorizedException, HttpCode } from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { Webhook } from "svix";
import { Public } from "../tenant/public.decorator.js";
import { ClerkWebhookService } from "./clerk-webhook.service.js";
import type { ClerkWebhookEvent } from "./clerk-events.js";

@Controller("webhooks/clerk")
export class ClerkWebhookController {
  constructor(private readonly service: ClerkWebhookService) {}

  /**
   * Public (Clerk n'a pas de session utilisateur), mais authentifié par la
   * signature Svix : sans le secret partagé, impossible de forger un événement
   * qui provisionnerait un faux tenant.
   */
  @Public()
  @Post()
  @HttpCode(200)
  async handle(@Req() req: RawBodyRequest<FastifyRequest>) {
    const secret = process.env.CLERK_WEBHOOK_SECRET;
    if (!secret) {
      throw new Error("CLERK_WEBHOOK_SECRET is not set");
    }

    const raw = req.rawBody;
    if (!raw) {
      throw new BadRequestException("Corps de requête brut absent");
    }

    const headers = req.headers;
    const svixHeaders = {
      "svix-id": headers["svix-id"] as string,
      "svix-timestamp": headers["svix-timestamp"] as string,
      "svix-signature": headers["svix-signature"] as string,
    };

    let event: ClerkWebhookEvent;
    try {
      event = new Webhook(secret).verify(raw.toString("utf8"), svixHeaders) as ClerkWebhookEvent;
    } catch {
      throw new UnauthorizedException("Signature de webhook invalide");
    }

    await this.service.handle(event);
    return { received: true };
  }
}
