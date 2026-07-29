import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { ResetForm } from "./ResetForm";

export const dynamic = "force-dynamic";

/**
 * Le jeton est lu côté serveur depuis l'URL plutôt qu'avec useSearchParams :
 * ça évite d'avoir à envelopper la page dans un Suspense et garde le
 * formulaire client réduit à ce qu'il fait vraiment (saisie + erreurs).
 */
export default function ReinitialiserPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token ?? "";

  if (!token) {
    return (
      <AuthShell
        titre="Lien incomplet"
        sousTitre="Ce lien de réinitialisation n'est pas valide."
        pied={
          <Link href="/mot-de-passe-oublie" className="font-semibold text-accent hover:underline">
            Refaire une demande
          </Link>
        }
      >
        <div className="card p-6 text-[14px] text-ink-soft">
          Ouvrez le lien directement depuis l'email reçu, sans le modifier.
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell titre="Nouveau mot de passe" sousTitre="Choisissez un mot de passe pour votre compte.">
      <ResetForm token={token} />
    </AuthShell>
  );
}
