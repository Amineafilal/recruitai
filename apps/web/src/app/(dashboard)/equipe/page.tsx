import { PageHeader } from "@/components/CockpitShell";
import { apiFetch } from "@/lib/api";
import { getSessionUser } from "@/lib/session";
import { InviteButton } from "./InviteButton";
import { MembreActions, InvitationActions } from "./RowActions";

export const dynamic = "force-dynamic";

interface MembreView {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}
interface InvitationView {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
}

const dateFr = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });

export default async function EquipePage() {
  const [{ membres, invitations, moi }, session] = await Promise.all([
    apiFetch<{ membres: MembreView[]; invitations: InvitationView[]; moi: string }>("/equipe"),
    getSessionUser(),
  ]);
  const estAdmin = session?.role === "admin";

  return (
    <>
      <PageHeader
        eyebrow={session?.agence ?? "Votre agence"}
        title="Équipe"
        subtitle="Invitez vos recruteurs : chacun accède aux mêmes postes, shortlists et CVthèque."
      >
        {estAdmin && <InviteButton />}
      </PageHeader>

      {!estAdmin && (
        <p className="mb-6 rounded-lg border border-line bg-paper-2 px-4 py-3 text-[13px] text-ink-soft">
          Seuls les administrateurs peuvent inviter ou retirer des membres.
        </p>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-faint">
          Membres · {membres.length}
        </h2>
        <div className="card divide-y divide-line">
          {membres.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-4 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-[13px] font-bold uppercase text-accent">
                  {m.email.slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-ink">
                    {m.email}
                    {m.id === moi && <span className="ml-2 text-[12px] text-ink-faint">(vous)</span>}
                  </p>
                  <p className="text-[12px] text-ink-faint">Membre depuis le {dateFr.format(new Date(m.createdAt))}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <RoleBadge role={m.role} />
                {estAdmin && m.id !== moi && <MembreActions id={m.id} email={m.email} role={m.role} />}
              </div>
            </div>
          ))}
        </div>
      </section>

      {invitations.length > 0 && (
        <section>
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-faint">
            Invitations en attente · {invitations.length}
          </h2>
          <div className="card divide-y divide-line">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-ink">{inv.email}</p>
                  <p className="text-[12px] text-ink-faint">
                    Expire le {dateFr.format(new Date(inv.expiresAt))}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <RoleBadge role={inv.role} />
                  {estAdmin && <InvitationActions id={inv.id} email={inv.email} />}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function RoleBadge({ role }: { role: string }) {
  const admin = role === "admin";
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${
        admin ? "bg-accent-soft text-accent" : "bg-paper-2 text-ink-soft"
      }`}
    >
      {admin ? "Administrateur" : "Recruteur"}
    </span>
  );
}
