import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { InvitationForm } from "./InvitationForm";

export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface InvitationDetails {
  email: string;
  agence: string;
  role: string;
}

/**
 * Page publique : le jeton de l'URL fait office d'authentification. On résout
 * l'invitation côté serveur pour afficher l'agence et l'email concernés avant
 * que la personne ne choisisse son mot de passe — sans ça, elle saisirait un
 * mot de passe sans savoir ce qu'elle rejoint.
 */
export default async function InvitationPage({ params }: { params: { token: string } }) {
  const res = await fetch(`${API_URL}/auth/invitation/${params.token}`, { cache: "no-store" });

  if (!res.ok) {
    return (
      <AuthShell
        titre="Invitation indisponible"
        sousTitre="Ce lien est invalide, expiré ou déjà utilisé."
        pied={
          <Link href="/connexion" className="font-semibold text-accent hover:underline">
            Aller à la connexion
          </Link>
        }
      >
        <div className="card p-6 text-[14px] leading-relaxed text-ink-soft">
          Demandez à l'administrateur de votre agence de vous renvoyer une invitation.
        </div>
      </AuthShell>
    );
  }

  const invitation = (await res.json()) as InvitationDetails;

  return (
    <AuthShell
      titre={`Rejoindre ${invitation.agence}`}
      sousTitre="Choisissez un mot de passe pour activer votre accès."
    >
      <InvitationForm token={params.token} email={invitation.email} role={invitation.role} />
    </AuthShell>
  );
}
