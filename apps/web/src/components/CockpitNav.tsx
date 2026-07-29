"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

function Icon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {d.split("|").map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  );
}

const ICONS: Record<string, ReactNode> = {
  dashboard: <Icon d="M3 3h8v8H3z|M13 3h8v5h-8z|M13 11h8v10h-8z|M3 13h8v8H3z" />,
  postes: <Icon d="M3 7h18v13H3z|M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />,
  cvtheque: <Icon d="M12 2 3 7l9 5 9-5-9-5z|M3 12l9 5 9-5|M3 17l9 5 9-5" />,
  campagnes: <Icon d="m22 2-7 20-4-9-9-4 20-7z" />,
  equipe: <Icon d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2|M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8|M22 21v-2a4 4 0 0 0-3-3.87|M16 3.13a4 4 0 0 1 0 7.75" />,
};

export function CockpitNav({ navBase = "" }: { navBase?: string }) {
  const pathname = usePathname();
  const items = [
    { key: "dashboard", href: `${navBase}/tableau-de-bord`, label: "Tableau de bord" },
    { key: "postes", href: `${navBase}/postes`, label: "Postes" },
    { key: "cvtheque", href: `${navBase}/cvtheque`, label: "CVthèque" },
    { key: "campagnes", href: `${navBase}/campagnes`, label: "Relances" },
    // La démo publique n'a pas d'écran Équipe (rien à administrer) : on
    // n'affiche l'entrée que dans l'application réelle, sinon le lien
    // pointerait vers une page inexistante.
    ...(navBase === "" ? [{ key: "equipe", href: "/equipe", label: "Équipe" }] : []),
  ];

  return (
    <nav className="flex flex-1 flex-col gap-1 px-4 py-1">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.key}
            href={item.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium transition-colors ${
              active ? "bg-accent-soft text-accent" : "text-ink-soft hover:bg-paper-2 hover:text-ink"
            }`}
          >
            <span className={active ? "text-accent" : "text-ink-faint"}>{ICONS[item.key]}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
