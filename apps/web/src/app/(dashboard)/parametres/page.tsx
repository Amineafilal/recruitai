import Link from "next/link";
import { PageHeader } from "@/components/CockpitShell";

export const dynamic = "force-dynamic";

/**
 * Point d'entrée des réglages.
 *
 * Un simple alias de /profil aurait fait disparaître l'adresse sans rien
 * apprendre : un utilisateur qui tape « paramètres » cherche aussi son équipe,
 * sa formule ou ses factures, éparpillés sur quatre écrans. Ce sommaire les
 * réunit et dit où chaque chose se trouve.
 */
const SECTIONS = [
  {
    href: "/profil",
    titre: "Profil et agence",
    texte: "Votre nom, votre email, votre mot de passe, et le nom de l'agence.",
  },
  {
    href: "/equipe",
    titre: "Équipe",
    texte: "Inviter des recruteurs, changer leurs droits, retirer un accès.",
  },
  {
    href: "/abonnement",
    titre: "Abonnement",
    texte: "Votre formule, ses limites, et ce que vous consommez réellement.",
  },
  {
    href: "/facturation",
    titre: "Facturation",
    texte: "Vos reçus et votre moyen de paiement.",
  },
];

export default function ParametresPage() {
  return (
    <>
      <PageHeader eyebrow="Configuration" title="Paramètres" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="card p-5 transition-shadow hover:shadow-card-hover"
          >
            <h2 className="font-display text-[15px] font-semibold text-ink">{s.titre}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{s.texte}</p>
            <span className="mt-3 inline-block text-[13px] font-semibold text-accent">Ouvrir →</span>
          </Link>
        ))}
      </div>
    </>
  );
}
