import Link from "next/link";
import { PageHeader } from "@/components/CockpitShell";
import { apiFetch } from "@/lib/api";

export const dynamic = "force-dynamic";

interface AbonnementView {
  libelle: string;
  prixMensuelCents: number;
  paiementActif: boolean;
}

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/**
 * Historique de facturation.
 *
 * Aucun paiement n'a encore transité : Stripe n'est pas branché et le webhook
 * `POST /billing/webhook` est un stub. Afficher un tableau vide sans
 * explication laisserait croire à une panne, et un bouton « accéder au portail
 * client » renverrait sur une page inexistante. On dit donc ce qui est.
 */
export default async function FacturationPage() {
  const abo = await apiFetch<AbonnementView>("/billing/abonnement");

  return (
    <>
      <PageHeader eyebrow="Paiements et reçus" title="Facturation" />

      {abo.paiementActif ? (
        <section className="card p-5">
          <p className="text-[14px] text-ink-soft">
            Vos reçus sont disponibles dans le portail de paiement sécurisé.
          </p>
        </section>
      ) : (
        <section className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
          <p className="font-display text-lg text-ink">Aucune facture pour le moment</p>
          <p className="max-w-md text-[14px] leading-relaxed text-ink-soft">
            Le paiement en ligne n'est pas encore ouvert : rien ne vous a été facturé, et aucun
            moyen de paiement ne vous est demandé. Vos reçus apparaîtront ici dès que la
            facturation sera activée.
          </p>
          <p className="text-[13px] text-ink-faint">
            Formule en cours : <strong className="text-ink-soft">{abo.libelle}</strong> —{" "}
            {euros.format(abo.prixMensuelCents / 100)} / mois
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
            <Link href="/abonnement" className="text-[13px] font-semibold text-accent hover:underline">
              Voir votre formule et sa consommation
            </Link>
            <a
              href="mailto:contact@recruitai.fr?subject=Facturation"
              className="text-[13px] font-semibold text-accent hover:underline"
            >
              Demander une facture
            </a>
          </div>
        </section>
      )}
    </>
  );
}
