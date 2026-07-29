import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "recruitai_session";

// Routes publiques : accueil, parcours d'authentification (y compris
// récupération de mot de passe et acceptation d'invitation, qui sont par
// nature accessibles sans session), désinscription RGPD, démo.
const PUBLIC = [
  /^\/$/,
  /^\/connexion/,
  /^\/inscription/,
  /^\/mot-de-passe-oublie/,
  /^\/reinitialiser-mot-de-passe/,
  /^\/invitation\//,
  /^\/desinscription/,
  /^\/demo/,
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((re) => re.test(pathname))) {
    return NextResponse.next();
  }
  // Route protégée : présence d'un cookie de session requise (l'API vérifie
  // la validité réelle du JWT ensuite).
  const hasSession = req.cookies.has(SESSION_COOKIE);
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/connexion";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
