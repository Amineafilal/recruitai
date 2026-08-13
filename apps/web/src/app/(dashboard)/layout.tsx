import { redirect } from "next/navigation";
import { CockpitShell } from "@/components/CockpitShell";
import { UserMenu } from "@/components/UserMenu";
import { getSessionUser } from "@/lib/session";
import { apiFetch } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/connexion");

  // Le compteur ne doit jamais empêcher l'affichage du cockpit : si l'API ne
  // répond pas, on se passe du badge plutôt que d'afficher une page d'erreur
  // à la place de toute l'application.
  const attente = await apiFetch<{ total: number; depasses: number }>("/candidats/en-attente").catch(
    () => ({ total: 0, depasses: 0 }),
  );

  return (
    <CockpitShell
      user={<UserMenu email={user.email} agence={user.agence} />}
      aValiderDepasses={attente.depasses}
    >
      {children}
    </CockpitShell>
  );
}
