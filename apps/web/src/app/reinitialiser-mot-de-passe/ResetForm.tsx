"use client";

import { useState } from "react";
import { reinitialiserMotDePasse } from "@/lib/auth-actions";
import { AuthField, AuthError, AuthSubmit } from "@/components/AuthShell";

export function ResetForm({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await reinitialiserMotDePasse(new FormData(e.currentTarget));
    if (res?.error) {
      setError(res.error);
      setPending(false);
    }
    // Succès → l'action redirige vers /connexion.
  }

  return (
    <form onSubmit={onSubmit} className="card flex flex-col gap-4 p-6">
      <input type="hidden" name="token" value={token} />
      <AuthField
        label="Nouveau mot de passe"
        name="password"
        type="password"
        placeholder="8 caractères minimum"
        autoComplete="new-password"
      />
      <AuthField
        label="Confirmer le mot de passe"
        name="confirmation"
        type="password"
        placeholder="Retapez-le"
        autoComplete="new-password"
      />
      {error && <AuthError>{error}</AuthError>}
      <AuthSubmit pending={pending}>{pending ? "Enregistrement…" : "Changer mon mot de passe"}</AuthSubmit>
    </form>
  );
}
