"use client";

import { useState } from "react";
import Link from "next/link";
import { demanderReinitialisation } from "@/lib/auth-actions";
import { AuthShell, AuthField, AuthError, AuthSubmit } from "@/components/AuthShell";

export default function MotDePasseOubliePage() {
  const [error, setError] = useState<string | null>(null);
  const [envoye, setEnvoye] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await demanderReinitialisation(new FormData(e.currentTarget));
    setPending(false);
    if (res?.error) setError(res.error);
    else setEnvoye(true);
  }

  if (envoye) {
    return (
      <AuthShell
        titre="Vérifiez votre boîte mail"
        sousTitre="Si un compte existe avec cet email, un lien de réinitialisation vient d'être envoyé."
        pied={
          <Link href="/connexion" className="font-semibold text-accent hover:underline">
            Retour à la connexion
          </Link>
        }
      >
        <div className="card p-6 text-[14px] leading-relaxed text-ink-soft">
          <p>Le lien est valable <strong className="text-ink">1 heure</strong> et ne fonctionne qu'une fois.</p>
          <p className="mt-3">
            Rien reçu au bout de quelques minutes ? Vérifiez vos indésirables, puis refaites une demande.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      titre="Mot de passe oublié"
      sousTitre="Indiquez votre email, nous vous envoyons un lien de réinitialisation."
      pied={
        <>
          Vous vous en souvenez ?{" "}
          <Link href="/connexion" className="font-semibold text-accent hover:underline">
            Se connecter
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="card flex flex-col gap-4 p-6">
        <AuthField label="Email" name="email" type="email" placeholder="vous@agence.fr" autoComplete="email" />
        {error && <AuthError>{error}</AuthError>}
        <AuthSubmit pending={pending}>{pending ? "Envoi…" : "Envoyer le lien"}</AuthSubmit>
      </form>
    </AuthShell>
  );
}
