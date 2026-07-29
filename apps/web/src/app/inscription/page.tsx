"use client";

import { useState } from "react";
import Link from "next/link";
import { signup } from "@/lib/auth-actions";
import { AuthShell, AuthField, AuthError, AuthSubmit } from "@/components/AuthShell";

export default function InscriptionPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await signup(new FormData(e.currentTarget));
    if (res?.error) {
      setError(res.error);
      setPending(false);
    }
  }

  return (
    <AuthShell
      titre="Créer votre agence"
      sousTitre="Votre espace de sourcing, prêt en une minute."
      pied={
        <>
          Déjà un compte ?{" "}
          <Link href="/connexion" className="font-semibold text-accent hover:underline">
            Se connecter
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="card flex flex-col gap-4 p-6">
        <AuthField label="Nom de l'agence" name="nomAgence" type="text" placeholder="Agence Convergence" />
        <AuthField label="Email" name="email" type="email" placeholder="vous@agence.fr" autoComplete="email" />
        <AuthField
          label="Mot de passe"
          name="password"
          type="password"
          placeholder="8 caractères minimum"
          autoComplete="new-password"
          hint="Au moins 8 caractères."
        />
        {error && <AuthError>{error}</AuthError>}
        <AuthSubmit pending={pending}>{pending ? "Création…" : "Créer mon agence"}</AuthSubmit>
      </form>
    </AuthShell>
  );
}
