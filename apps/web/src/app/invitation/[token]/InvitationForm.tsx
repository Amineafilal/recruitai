"use client";

import { useState } from "react";
import { accepterInvitation } from "@/lib/auth-actions";
import { AuthField, AuthError, AuthSubmit } from "@/components/AuthShell";

export function InvitationForm({ token, email, role }: { token: string; email: string; role: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await accepterInvitation(new FormData(e.currentTarget));
    if (res?.error) {
      setError(res.error);
      setPending(false);
    }
    // Succès → l'action pose la session et redirige vers le tableau de bord.
  }

  return (
    <form onSubmit={onSubmit} className="card flex flex-col gap-4 p-6">
      <input type="hidden" name="token" value={token} />
      {/* L'email est imposé par l'invitation : le champ est affiché pour
          confirmation mais reste non modifiable. */}
      <AuthField label="Email" name="emailAffiche" type="email" defaultValue={email} readOnly />
      <div className="flex items-center gap-2 text-[13px] text-ink-soft">
        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[12px] font-semibold text-accent">
          {role === "admin" ? "Administrateur" : "Recruteur"}
        </span>
        <span>rôle attribué par votre agence</span>
      </div>
      <AuthField
        label="Mot de passe"
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
      <AuthSubmit pending={pending}>{pending ? "Création…" : "Rejoindre l'agence"}</AuthSubmit>
    </form>
  );
}
