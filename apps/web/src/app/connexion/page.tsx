import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default function ConnexionPage({ searchParams }: { searchParams: { reinitialise?: string } }) {
  return (
    <AuthShell
      titre="Connexion"
      sousTitre="Accédez au cockpit de votre agence."
      pied={
        <>
          Pas encore de compte ?{" "}
          <Link href="/inscription" className="font-semibold text-accent hover:underline">
            Créer une agence
          </Link>
        </>
      }
    >
      {/* Confirmation après un changement de mot de passe réussi : sans ce
          repère, le recruteur est renvoyé sur un écran de connexion vierge
          sans savoir si l'opération a fonctionné. */}
      {searchParams.reinitialise === "1" && (
        <p className="mb-4 rounded-lg border border-emerald/30 bg-emerald/10 px-3 py-2.5 text-[13px] font-medium text-emerald">
          Mot de passe modifié. Connectez-vous avec le nouveau.
        </p>
      )}
      <LoginForm />
    </AuthShell>
  );
}
