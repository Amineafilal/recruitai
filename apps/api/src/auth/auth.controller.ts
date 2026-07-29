import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { z } from "zod";
import { Public } from "../tenant/public.decorator.js";
import { CurrentTenant } from "../tenant/tenant.decorator.js";
import type { TenantContext } from "../tenant/tenant-context.js";
import { AuthService } from "./auth.service.js";

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Le mot de passe doit faire au moins 8 caractères."),
  nomAgence: z.string().min(1),
});
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
const OubliSchema = z.object({ email: z.string().email() });
const ReinitSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Le mot de passe doit faire au moins 8 caractères."),
});
const ChangerMdpSchema = z.object({
  ancien: z.string().min(1, "Renseignez votre mot de passe actuel."),
  nouveau: z.string().min(8, "Le nouveau mot de passe doit faire au moins 8 caractères."),
});
const AgenceSchema = z.object({
  nom: z.string().trim().min(1, "Le nom de l'agence est obligatoire.").max(120),
});
const AccepterInvitSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Le mot de passe doit faire au moins 8 caractères."),
});

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("signup")
  async signup(@Body() body: unknown) {
    const parsed = SignupSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.authService.signup(parsed.data.email, parsed.data.password, parsed.data.nomAgence);
  }

  @Public()
  @Post("login")
  async login(@Body() body: unknown) {
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.authService.login(parsed.data.email, parsed.data.password);
  }

  /**
   * Réponse volontairement identique que l'email existe ou non : ce
   * formulaire est public, il ne doit pas permettre de découvrir qui est
   * client. Le message affiché côté web est donc toujours « si un compte
   * existe, vous recevrez un email ».
   */
  @Public()
  @Post("mot-de-passe-oublie")
  async motDePasseOublie(@Body() body: unknown) {
    const parsed = OubliSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    await this.authService.demanderReinitialisation(parsed.data.email);
    return { ok: true };
  }

  @Public()
  @Post("reinitialiser")
  async reinitialiser(@Body() body: unknown) {
    const parsed = ReinitSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    await this.authService.reinitialiser(parsed.data.token, parsed.data.password);
    return { ok: true };
  }

  @Public()
  @Get("invitation/:token")
  async invitation(@Param("token") token: string) {
    return this.authService.consulterInvitation(token);
  }

  @Public()
  @Post("invitation/accepter")
  async accepterInvitation(@Body() body: unknown) {
    const parsed = AccepterInvitSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.authService.accepterInvitation(parsed.data.token, parsed.data.password);
  }

  @Get("me")
  async me(@CurrentTenant() tenant: TenantContext) {
    const user = await this.authService.me(tenant.userId);
    if (!user) throw new UnauthorizedException();
    return user;
  }

  @Patch("mot-de-passe")
  async changerMotDePasse(@CurrentTenant() tenant: TenantContext, @Body() body: unknown) {
    const parsed = ChangerMdpSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    await this.authService.changerMotDePasse(tenant.userId, parsed.data.ancien, parsed.data.nouveau);
    return { ok: true };
  }

  @Patch("agence")
  async renommerAgence(@CurrentTenant() tenant: TenantContext, @Body() body: unknown) {
    if (tenant.role !== "admin") {
      throw new ForbiddenException("Seul un administrateur peut renommer l'agence.");
    }
    const parsed = AgenceSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.authService.renommerAgence(tenant.tenantId, tenant.userId, parsed.data.nom);
  }
}
