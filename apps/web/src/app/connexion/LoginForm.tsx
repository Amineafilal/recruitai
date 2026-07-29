"use client";

import { useState } from "react";
import Link from "next/link";
import { login } from "@/lib/auth-actions";
import { AuthField, AuthError, AuthSubmit } from "@/components/AuthShell";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await login(new FormData(e.currentTarget));
    if (res?.error) {
      setError(res.error);
      setPending(false);
    }
    // Succès → l'action redirige.
  }

  return (
    <form onSubmit={onSubmit} className="card flex flex-col gap-4 p-6">
      <AuthField label="Email" name="email" type="email" placeholder="vous@agence.fr" autoComplete="email" />
      <div className="flex flex-col gap-1.5">
        <AuthField
          label="Mot de passe"
          name="password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          minLength={1}
        />
        <Link
          href="/mot-de-passe-oublie"
          className="self-end text-[13px] font-medium text-accent hover:underline"
        >
          Mot de passe oublié ?
        </Link>
      </div>

      {error && <AuthError>{error}</AuthError>}
      <AuthSubmit pending={pending}>{pending ? "Connexion…" : "Se connecter"}</AuthSubmit>
    </form>
  );
}
