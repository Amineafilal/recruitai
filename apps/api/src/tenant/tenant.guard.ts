import { Injectable, CanActivate, type ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "./public.decorator.js";
import type { TenantContext } from "./tenant-context.js";
import { AuthService } from "../auth/auth.service.js";
import type { UserRole } from "@recruitai/types";

/**
 * Vérifie le JWT interne (émis par AuthService) et attache le contexte tenant
 * à la requête. L'isolation applicative repose ensuite sur ce tenantId, passé
 * à withTenant() par les services.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      tenantContext?: TenantContext;
    }>();

    const authHeader = request.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : undefined;
    if (!token) {
      throw new UnauthorizedException("Session absente");
    }

    let claims: { userId: string; tenantId: string; role: string };
    try {
      claims = this.authService.verify(token);
    } catch {
      throw new UnauthorizedException("Session invalide ou expirée");
    }

    request.tenantContext = {
      tenantId: claims.tenantId,
      userId: claims.userId,
      clerkUserId: claims.userId,
      role: claims.role as UserRole,
    };
    return true;
  }
}
