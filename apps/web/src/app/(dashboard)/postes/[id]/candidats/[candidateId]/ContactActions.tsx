"use client";

import { useState } from "react";

/**
 * Coordonnées et moyens de contact d'un candidat.
 *
 * Les profils issus du scraping LinkedIn n'ont ni email ni téléphone : on
 * l'affiche franchement plutôt que de laisser des champs vides qui feraient
 * croire à un bug, et on propose LinkedIn comme voie de contact réelle.
 */
export function ContactActions({
  nom,
  email,
  telephone,
  linkedinUrl,
}: {
  nom: string;
  email: string | null;
  telephone: string | null;
  linkedinUrl?: string;
}) {
  const [copie, setCopie] = useState<string | null>(null);

  async function copier(valeur: string, quoi: string) {
    await navigator.clipboard.writeText(valeur);
    setCopie(quoi);
    setTimeout(() => setCopie(null), 1800);
  }

  // WhatsApp exige un numéro international sans espace ni séparateur.
  const numeroWhatsapp = telephone?.replace(/[^\d+]/g, "").replace(/^\+/, "");

  const sujet = encodeURIComponent(`Opportunité professionnelle`);
  const corps = encodeURIComponent(
    `Bonjour ${nom.split(" ")[0] ?? ""},\n\nJe vous contacte au sujet d'une opportunité qui pourrait vous intéresser.\n\n`,
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Coordonnee
          label="Email"
          valeur={email}
          onCopier={email ? () => copier(email, "email") : undefined}
          copie={copie === "email"}
        />
        <Coordonnee
          label="Téléphone"
          valeur={telephone}
          onCopier={telephone ? () => copier(telephone, "tel") : undefined}
          copie={copie === "tel"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {email && (
          <a
            href={`mailto:${email}?subject=${sujet}&body=${corps}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-accent-ink"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m2 7 10 6 10-6" />
            </svg>
            Envoyer un email
          </a>
        )}

        {numeroWhatsapp && (
          <a
            href={`https://wa.me/${numeroWhatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald/40 bg-emerald/10 px-3.5 py-2 text-[13px] font-semibold text-emerald transition-colors hover:bg-emerald/20"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.04 2a9.9 9.9 0 0 0-8.5 14.9L2 22l5.25-1.38A9.9 9.9 0 1 0 12.04 2Zm0 1.8a8.1 8.1 0 1 1-4.13 15.06l-.3-.18-3.11.82.83-3.03-.2-.31A8.1 8.1 0 0 1 12.04 3.8Zm4.44 10.2c-.24-.12-1.43-.7-1.65-.78-.22-.08-.38-.12-.54.12s-.62.78-.76.94c-.14.16-.28.18-.52.06a6.6 6.6 0 0 1-3.3-2.88c-.25-.43.25-.4.71-1.32.08-.16.04-.3-.02-.42s-.54-1.3-.74-1.78c-.2-.47-.4-.4-.54-.41h-.46a.9.9 0 0 0-.64.3 2.7 2.7 0 0 0-.84 2c0 1.18.86 2.32.98 2.48s1.7 2.6 4.12 3.64c1.53.66 2.13.72 2.9.6.46-.06 1.43-.58 1.63-1.15.2-.56.2-1.05.14-1.15-.06-.1-.22-.16-.46-.28Z" />
            </svg>
            WhatsApp
          </a>
        )}

        {linkedinUrl && (
          <a
            href={linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors ${
              email || numeroWhatsapp
                ? "border border-line text-ink-soft hover:text-ink"
                : "bg-accent text-white hover:bg-accent-ink"
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4.98 3.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM2.4 21h5.16V9.5H2.4V21Zm7.9 0h5.15v-6.2c0-3.3 4.3-3.57 4.3 0V21h5.16v-7.98c0-8.06-9.2-7.76-9.46-3.8V9.5H10.3V21Z" />
            </svg>
            Contacter via LinkedIn
          </a>
        )}
      </div>

      {!email && !telephone && (
        <p className="text-[12px] text-ink-faint">
          LinkedIn ne publie pas les coordonnées. Elles apparaîtront ici pour les profils importés depuis
          votre CVthèque.
        </p>
      )}
    </div>
  );
}

function Coordonnee({
  label,
  valeur,
  onCopier,
  copie,
}: {
  label: string;
  valeur: string | null;
  onCopier?: () => void;
  copie: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] uppercase tracking-wider text-ink-faint">{label}</span>
      {valeur ? (
        <button
          onClick={onCopier}
          title="Copier"
          className="text-[13px] font-medium text-ink transition-colors hover:text-accent"
        >
          {copie ? "Copié ✓" : valeur}
        </button>
      ) : (
        <span className="text-[13px] text-ink-faint">non disponible</span>
      )}
    </div>
  );
}
