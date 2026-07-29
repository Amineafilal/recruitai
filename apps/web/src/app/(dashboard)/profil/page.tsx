import { redirect } from "next/navigation";
import { PageHeader } from "@/components/CockpitShell";
import { getSessionUser } from "@/lib/session";
import { PasswordForm, AgenceForm } from "./Forms";

export const dynamic = "force-dynamic";

export default async function ProfilPage() {
  const session = await getSessionUser();
  if (!session) redirect("/connexion");
  const estAdmin = session.role === "admin";

  return (
    <>
      <PageHeader
        eyebrow="Mon compte"
        title="Profil"
        subtitle="Vos informations de connexion et les réglages de votre agence."
      />

      <div className="flex max-w-2xl flex-col gap-6">
        <section className="card p-5 sm:p-6">
          <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-wider text-ink-faint">
            Informations
          </h2>
          <dl className="flex flex-col gap-3">
            <Ligne label="Email" valeur={session.email} />
            <Ligne label="Agence" valeur={session.agence} />
            <Ligne label="Rôle" valeur={estAdmin ? "Administrateur" : "Recruteur"} />
          </dl>
          <p className="mt-4 border-t border-line pt-4 text-[13px] text-ink-soft">
            L'email sert d'identifiant de connexion et ne peut pas être modifié ici. Pour en changer,
            demandez une invitation sur la nouvelle adresse.
          </p>
        </section>

        <section className="card p-5 sm:p-6">
          <h2 className="mb-1 text-[13px] font-semibold uppercase tracking-wider text-ink-faint">
            Mot de passe
          </h2>
          <p className="mb-4 text-[13px] text-ink-soft">
            Votre mot de passe actuel est demandé pour confirmer que c'est bien vous.
          </p>
          <PasswordForm />
        </section>

        <section className="card p-5 sm:p-6">
          <h2 className="mb-1 text-[13px] font-semibold uppercase tracking-wider text-ink-faint">
            Agence
          </h2>
          <p className="mb-4 text-[13px] text-ink-soft">
            Ce nom apparaît dans les invitations envoyées à vos collègues.
          </p>
          {estAdmin ? (
            <AgenceForm nomActuel={session.agence} />
          ) : (
            <p className="rounded-lg border border-line bg-paper-2 px-4 py-3 text-[13px] text-ink-soft">
              Seul un administrateur peut renommer l'agence.
            </p>
          )}
        </section>
      </div>
    </>
  );
}

function Ligne({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3 last:border-0 last:pb-0">
      <dt className="text-[13px] text-ink-soft">{label}</dt>
      <dd className="text-[14px] font-medium text-ink">{valeur || "—"}</dd>
    </div>
  );
}
