import type { ReactNode } from "react";
import { AuthBackground } from "./AuthBackground";

/**
 * Habillage commun des pages hors application (connexion, inscription,
 * mot de passe oublié, invitation) : même fond animé, même en-tête, pour que
 * ces écrans se ressemblent quel que soit le point d'entrée du recruteur.
 */
export function AuthShell({
  titre,
  sousTitre,
  children,
  pied,
}: {
  titre: string;
  sousTitre: string;
  children: ReactNode;
  pied?: ReactNode;
}) {
  return (
    <main className="grid min-h-screen place-items-center px-6 py-10">
      <AuthBackground />
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-accent text-[17px] font-extrabold text-white">
            R
          </div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-ink">{titre}</h1>
          <p className="mt-1 text-[14px] text-ink-soft">{sousTitre}</p>
        </div>
        {children}
        {pied && <p className="mt-5 text-center text-[14px] text-ink-soft">{pied}</p>}
      </div>
    </main>
  );
}

export function AuthField({
  label,
  name,
  type,
  placeholder,
  autoComplete,
  hint,
  defaultValue,
  readOnly,
  minLength,
}: {
  label: string;
  name: string;
  type: string;
  placeholder?: string;
  autoComplete?: string;
  hint?: string;
  defaultValue?: string;
  readOnly?: boolean;
  minLength?: number;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-ink-soft">{label}</span>
      <input
        name={name}
        type={type}
        required
        minLength={minLength ?? (type === "password" ? 8 : undefined)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        readOnly={readOnly}
        className={`rounded-lg border border-line px-3 py-2.5 text-[14px] text-ink outline-none placeholder:text-ink-faint focus:border-accent focus:ring-2 focus:ring-accent-soft ${
          readOnly ? "cursor-not-allowed bg-paper-2 text-ink-soft" : "bg-paper"
        }`}
      />
      {hint && <span className="text-[12px] text-ink-faint">{hint}</span>}
    </label>
  );
}

export function AuthError({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] font-medium text-danger">{children}</p>
  );
}

export function AuthSubmit({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-accent px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-accent-ink disabled:opacity-50"
    >
      {children}
    </button>
  );
}
