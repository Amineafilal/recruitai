import Link from "next/link";
import { PageHeader } from "@/components/CockpitShell";
import { apiFetch } from "@/lib/api";

export const dynamic = "force-dynamic";

interface UsageView {
  cle: string;
  libelle: string;
  utilise: number;
  /** null = sans limite (plan Enterprise). */
  plafond: number | null;
}

interface AbonnementView {
  plan: string;
  libelle: string;
  prixMensuelCents: number;
  usages: UsageView[];
  paiementActif: boolean;
}

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const nombre = new Intl.NumberFormat("fr-FR");

export default async function AbonnementPage() {
  const abo = await apiFetch<AbonnementView>("/billing/abonnement");

  return (
    <>
      <PageHeader eyebrow="Votre formule" title="Abonnement" />

      <div className="card mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-[12px] uppercase tracking-wider text-ink-faint">Formule active</p>
          <p className="mt-1 font-display text-2xl font-bold text-ink">{abo.libelle}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl font-bold text-accent">
            {euros.format(abo.prixMensuelCents / 100)}
          </p>
          <p className="text-[12px] text-ink-faint">par mois, hors taxes</p>
        </div>
      </div>

      {/* Les limites du plan ne servent à rien sans le chiffre en face : un
          recruteur qui lit « 10 000 profils » ignore s'il en est à 200 ou à
          9 800, et découvre le plafond le jour où un import est refusé. */}
      <section className="card mb-6 p-5">
        <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-wider text-ink-faint">
          Ce que vous consommez
        </h2>
        <div className="flex flex-col gap-4">
          {abo.usages.map((u) => (
            <Usage key={u.cle} usage={u} />
          ))}
        </div>
      </section>

      {/* Dire l'état réel plutôt que d'afficher un bouton qui ne mène nulle
          part : le paiement en ligne n'est pas encore branché, et un lien mort
          vers un portail client coûte plus de confiance qu'une phrase claire. */}
      <section className="card p-5">
        <h2 className="mb-1 text-[13px] font-semibold uppercase tracking-wider text-ink-faint">
          Changer de formule
        </h2>
        {abo.paiementActif ? (
          <p className="text-[14px] text-ink-soft">
            Le paiement en ligne est actif. Rendez-vous sur la page{" "}
            <Link href="/facturation" className="font-medium text-accent hover:underline">
              Facturation
            </Link>{" "}
            pour gérer votre moyen de paiement et vos reçus.
          </p>
        ) : (
          <>
            <p className="text-[14px] leading-relaxed text-ink-soft">
              Le paiement en ligne n'est pas encore ouvert. Les changements de formule se font pour
              l'instant à la main, sans interruption de service et sans frais de migration.
            </p>
            <a
              href="mailto:contact@recruitai.fr?subject=Changement%20de%20formule"
              className="mt-3 inline-block rounded-lg border border-accent/40 px-4 py-2 text-[14px] font-semibold text-accent transition-colors hover:bg-accent-soft"
            >
              Nous écrire pour changer de formule
            </a>
          </>
        )}
      </section>
    </>
  );
}

function Usage({ usage }: { usage: UsageView }) {
  const plafond = usage.plafond;
  const illimite = plafond === null;
  const part = illimite ? 0 : Math.min(100, Math.round((usage.utilise / Math.max(plafond, 1)) * 100));
  const depasse = !illimite && usage.utilise > plafond;
  // Trois paliers : on prévient AVANT le blocage, pas au moment où l'import
  // est refusé.
  const couleur = depasse || part >= 90 ? "bg-danger" : part >= 70 ? "bg-amber" : "bg-accent";

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-[14px] text-ink">{usage.libelle}</span>
        <span className="font-mono text-[13px] tabular-nums text-ink-soft">
          {nombre.format(usage.utilise)}
          <span className="text-ink-faint">
            {" / "}
            {illimite ? "illimité" : nombre.format(plafond)}
          </span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-paper-2">
        {!illimite && <div className={`h-full rounded-full ${couleur}`} style={{ width: `${part}%` }} />}
      </div>
      {/* Dépassé et « bientôt atteint » sont deux situations différentes.
          Écrire « vous approchez » devant 7 postes pour un plafond de 5 ferait
          douter de tout le reste de la page. */}
      {!illimite && depasse && (
        <p className="mt-1 text-[12px] font-medium text-danger">
          Limite dépassée de {nombre.format(usage.utilise - plafond)} — votre formule en autorise{" "}
          {nombre.format(plafond)}.
        </p>
      )}
      {!illimite && !depasse && part >= 90 && (
        <p className="mt-1 text-[12px] font-medium text-amber">
          Vous approchez de la limite de votre formule.
        </p>
      )}
    </div>
  );
}
