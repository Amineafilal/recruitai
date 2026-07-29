"use client";

import { useRef, useState, useTransition } from "react";
import { changerMotDePasse, renommerAgence } from "./actions";

function Champ({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] text-ink-soft">{label}</span>
      <input
        name={name}
        type={type}
        required
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="rounded-lg border border-line bg-paper px-3 py-2.5 text-[14px] text-ink outline-none placeholder:text-ink-faint focus:border-accent focus:ring-2 focus:ring-accent-soft"
      />
    </label>
  );
}

function Retour({ ok, error }: { ok: boolean; error: string | null }) {
  if (error) {
    return (
      <p className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] font-medium text-danger">{error}</p>
    );
  }
  if (ok) {
    return (
      <p className="rounded-lg border border-emerald/30 bg-emerald/10 px-3 py-2 text-[13px] font-medium text-emerald">
        Enregistré.
      </p>
    );
  }
  return null;
}

export function PasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  function action(fd: FormData) {
    start(async () => {
      const res = await changerMotDePasse(fd);
      setError(res.error ?? null);
      setOk(Boolean(res.ok));
      // Les champs sont vidés après succès : laisser un mot de passe affiché
      // dans un formulaire déjà soumis n'a aucune utilité.
      if (res.ok) formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      <Champ
        label="Mot de passe actuel"
        name="ancien"
        type="password"
        placeholder="••••••••"
        autoComplete="current-password"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Champ
          label="Nouveau mot de passe"
          name="nouveau"
          type="password"
          placeholder="8 caractères minimum"
          autoComplete="new-password"
        />
        <Champ
          label="Confirmer"
          name="confirmation"
          type="password"
          placeholder="Retapez-le"
          autoComplete="new-password"
        />
      </div>
      <Retour ok={ok} error={error} />
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-accent px-4 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-accent-ink disabled:opacity-50"
      >
        {pending ? "Enregistrement…" : "Changer le mot de passe"}
      </button>
    </form>
  );
}

export function AgenceForm({ nomActuel }: { nomActuel: string }) {
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  function action(fd: FormData) {
    start(async () => {
      const res = await renommerAgence(fd);
      setError(res.error ?? null);
      setOk(Boolean(res.ok));
    });
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <Champ label="Nom de l'agence" name="nom" defaultValue={nomActuel} placeholder="Agence Convergence" />
      <Retour ok={ok} error={error} />
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-accent px-4 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-accent-ink disabled:opacity-50"
      >
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}
