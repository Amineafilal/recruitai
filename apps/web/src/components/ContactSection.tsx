"use client";

import { useRef, useState } from "react";
import { Reveal } from "./Reveal";
import { Sparkle } from "./Doodles";

const CORAL = "#FB6D4C";
const TEAL = "#63D2C3";
const NAVY = "#1C1E3A";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/**
 * Formulaire de contact de la landing page.
 *
 * Il appelle l'API publiquement depuis le navigateur (pas de server action) :
 * la page d'accueil reste ainsi entièrement statique, sans rendu dynamique
 * imposé par un formulaire.
 */
export function ContactSection() {
  const formRef = useRef<HTMLFormElement>(null);
  const [etat, setEtat] = useState<"repos" | "envoi" | "succes">("repos");
  const [erreur, setErreur] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEtat("envoi");
    setErreur(null);

    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch(`${API_URL}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: String(fd.get("nom") ?? ""),
          email: String(fd.get("email") ?? ""),
          societe: String(fd.get("societe") ?? ""),
          message: String(fd.get("message") ?? ""),
          siteWeb: String(fd.get("siteWeb") ?? ""),
        }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { message?: unknown };
        throw new Error(typeof b.message === "string" ? b.message : "Envoi impossible.");
      }
      formRef.current?.reset();
      setEtat("succes");
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Envoi impossible.");
      setEtat("repos");
    }
  }

  return (
    <section id="contact" className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <Reveal>
          <p className="text-[13px] font-bold uppercase tracking-wider" style={{ color: CORAL }}>
            Contact
          </p>
          <h2 className="mt-3 text-[32px] font-extrabold leading-[1.1] tracking-tight sm:text-[42px]">
            Une question ?
            <br />
            Parlons de votre agence.
          </h2>
          <p className="mt-4 max-w-md text-[16px] leading-relaxed text-[#5a5c72]">
            Décrivez-nous votre volume de recrutement et vos outils actuels. Nous revenons vers vous sous
            24&nbsp;h ouvrées avec une réponse concrète, pas un argumentaire.
          </p>

          <ul className="mt-8 flex flex-col gap-3">
            {[
              "Démonstration sur vos propres critères de poste",
              "Estimation du volume de candidats sourçables",
              "Réponse à vos questions RGPD",
            ].map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-[15px] text-[#5a5c72]">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={TEAL}
                  strokeWidth="3"
                  className="mt-1 shrink-0"
                >
                  <path d="m5 12 5 5L20 7" />
                </svg>
                {p}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={100}>
          <div className="relative rounded-[28px] bg-white p-6 shadow-[0_24px_60px_-30px_rgba(20,20,40,0.4)] sm:p-8">
            <Sparkle className="absolute -right-3 -top-3 hidden sm:block" color={CORAL} />

            {etat === "succes" ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-center">
                <span
                  className="grid h-14 w-14 place-items-center rounded-full text-white"
                  style={{ background: TEAL }}
                >
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="m5 12 5 5L20 7" />
                  </svg>
                </span>
                <h3 className="text-[20px] font-extrabold tracking-tight">Message envoyé</h3>
                <p className="max-w-xs text-[15px] text-[#5a5c72]">
                  Merci ! Nous vous répondons sous 24&nbsp;h ouvrées.
                </p>
                <button
                  onClick={() => setEtat("repos")}
                  className="mt-2 text-[14px] font-bold hover:underline"
                  style={{ color: CORAL }}
                >
                  Envoyer un autre message
                </button>
              </div>
            ) : (
              <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Champ name="nom" label="Nom" placeholder="Camille Durand" required />
                  <Champ name="societe" label="Agence" placeholder="Convergence RH" />
                </div>
                <Champ
                  name="email"
                  type="email"
                  label="Email professionnel"
                  placeholder="camille@agence.fr"
                  required
                />

                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-semibold text-[#4a4c63]">Votre message</span>
                  <textarea
                    name="message"
                    required
                    minLength={10}
                    rows={5}
                    placeholder="Nous sommes 6 recruteurs, environ 40 postes par an, et une CVthèque de 12 000 profils qui dort…"
                    className="resize-y rounded-2xl border border-[#E7E1D5] bg-[#FBF9F5] px-4 py-3 text-[15px] leading-relaxed text-[#20223D] outline-none transition-colors placeholder:text-[#a0a2b4] focus:border-[#FB6D4C] focus:bg-white"
                  />
                </label>

                {/* Piège à robots : hors écran et ignoré des lecteurs d'écran.
                    Un humain ne le remplit jamais. */}
                <input
                  type="text"
                  name="siteWeb"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="absolute left-[-9999px] h-0 w-0 opacity-0"
                />

                {erreur && (
                  <p className="rounded-xl bg-[#FEE2E2] px-4 py-2.5 text-[13px] font-semibold text-[#DC2626]">
                    {erreur}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={etat === "envoi"}
                  className="mt-1 rounded-full px-6 py-3.5 text-[15px] font-bold text-white transition-transform hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100"
                  style={{ background: CORAL }}
                >
                  {etat === "envoi" ? "Envoi…" : "Envoyer le message"}
                </button>

                <p className="text-center text-[12px] text-[#a0a2b4]">
                  Vos données servent uniquement à vous répondre. Aucun démarchage.
                </p>
              </form>
            )}
          </div>
        </Reveal>
      </div>

      <Reveal>
        <p className="mt-12 text-center text-[15px] text-[#5a5c72]">
          Vous préférez tester directement ?{" "}
          <a href="/demo" className="font-bold hover:underline" style={{ color: NAVY }}>
            Voir la démo interactive →
          </a>
        </p>
      </Reveal>
    </section>
  );
}

function Champ({
  name,
  label,
  placeholder,
  type = "text",
  required,
}: {
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold text-[#4a4c63]">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="rounded-2xl border border-[#E7E1D5] bg-[#FBF9F5] px-4 py-3 text-[15px] text-[#20223D] outline-none transition-colors placeholder:text-[#a0a2b4] focus:border-[#FB6D4C] focus:bg-white"
      />
    </label>
  );
}
