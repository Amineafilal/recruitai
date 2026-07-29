import { redirect } from "next/navigation";
import { CockpitShell } from "@/components/CockpitShell";
import { UserMenu } from "@/components/UserMenu";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/connexion");

  return (
    <CockpitShell user={<UserMenu email={user.email} agence={user.agence} />}>{children}</CockpitShell>
  );
}
