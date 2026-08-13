import type { ReactNode } from "react";
import { CockpitNav } from "./CockpitNav";
import { MobileSidebar } from "./MobileSidebar";

/** Contenu de la barre latérale, partagé entre le rail fixe et le tiroir mobile. */
function SidebarContenu({ navBase, aValiderDepasses = 0 }: { navBase: string; aValiderDepasses?: number }) {
  return (
    <>
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-[15px] font-extrabold text-white">
          R
        </div>
        <span className="text-[17px] font-extrabold tracking-tight text-ink">RecruitAI</span>
      </div>
      <div className="px-4 pb-2">
        <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Menu</p>
      </div>
      <CockpitNav navBase={navBase} aValiderDepasses={aValiderDepasses} />
    </>
  );
}

export function CockpitShell({
  children,
  navBase = "",
  user,
  aValiderDepasses = 0,
}: {
  children: ReactNode;
  navBase?: string;
  user?: ReactNode;
  /** Candidats « à valider » laissés en attente depuis plus de 48 h. */
  aValiderDepasses?: number;
}) {
  return (
    <div className="flex min-h-screen bg-paper">
      {/* Rail fixe à partir de lg. En dessous, la place est trop rare : la
          navigation passe dans un tiroir ouvert depuis l'en-tête. */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-line bg-card lg:flex">
        <SidebarContenu navBase={navBase} aValiderDepasses={aValiderDepasses} />
      </aside>

      {/* min-w-0 : sans lui, un enfant flex garde `min-width: auto` et un
          contenu large (le tableau Kanban) élargit toute la page au lieu de
          défiler dans son propre conteneur. */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line bg-card/80 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <MobileSidebar>
              <SidebarContenu navBase={navBase} aValiderDepasses={aValiderDepasses} />
            </MobileSidebar>
            {/* La recherche mange trop de place sur mobile : masquée jusqu'à sm. */}
            <div className="hidden items-center gap-2 rounded-lg border border-line bg-paper px-3 py-2 text-[13px] text-ink-faint sm:flex">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <span>Rechercher…</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">{user}</div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-7 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:mb-7 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-[12px] font-semibold uppercase tracking-wider text-accent">{eyebrow}</p>
        )}
        <h1 className="text-[22px] font-extrabold tracking-tight text-ink sm:text-[26px]">{title}</h1>
        {subtitle && <p className="mt-1 text-[14px] text-ink-soft">{subtitle}</p>}
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-3">{children}</div>}
    </header>
  );
}
