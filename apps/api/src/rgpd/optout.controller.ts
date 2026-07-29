import { Controller, Post, Param, BadRequestException } from "@nestjs/common";
import { z } from "zod";
import { Public } from "../tenant/public.decorator.js";
import { OptOutService } from "./optout.service.js";

const TokenSchema = z.string().uuid();

@Controller("desinscription")
export class OptOutController {
  constructor(private readonly optOutService: OptOutService) {}

  /**
   * POST (et non GET) : les clients mail et antivirus pré-visitent les liens
   * d'un email, ce qui déclencherait des désinscriptions fantômes sur un GET.
   * La page front affiche donc un bouton de confirmation qui appelle cette
   * route.
   */
  @Public()
  @Post(":token")
  async optOut(@Param("token") token: string) {
    const parsed = TokenSchema.safeParse(token);
    if (!parsed.success) {
      throw new BadRequestException("Lien de désinscription invalide.");
    }
    const { dejaDesinscrit } = await this.optOutService.optOutByToken(parsed.data);
    return {
      message: dejaDesinscrit
        ? "Vous étiez déjà désinscrit. Vous ne recevrez plus de messages."
        : "Vous êtes désinscrit. Vous ne recevrez plus de messages.",
    };
  }
}
