import { randomBytes, createHash } from "node:crypto";

/**
 * Jetons à usage unique envoyés par email (réinitialisation de mot de passe,
 * invitation).
 *
 * Le jeton part dans le lien ; seule son empreinte SHA-256 est stockée en
 * base. Une fuite de la base ne permet donc pas de reconstituer un lien
 * valide et de prendre la main sur un compte.
 *
 * Pas de bcrypt ici, contrairement aux mots de passe : un secret aléatoire de
 * 256 bits n'est pas attaquable par force brute, un hachage lent n'apporterait
 * rien et ferait payer le coût à chaque vérification.
 */
export function genererToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
