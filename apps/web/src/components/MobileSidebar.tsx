"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * Tiroir de navigation pour mobile et tablette. Reçoit exactement le même
 * contenu que le rail fixe du bureau, pour qu'il n'existe qu'une seule
 * définition du menu à maintenir.
 */
export function MobileSidebar({ children }: { children: ReactNode }) {
  const [ouvert, setOuvert] = useState(false);
  const pathname = usePathname();

  // Refermer à chaque navigation : sinon le tiroir masque la page qu'on vient
  // d'ouvrir en cliquant dedans.
  useEffect(() => setOuvert(false), [pathname]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOuvert(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Empêche le défilement de la page derrière le tiroir ouvert.
  useEffect(() => {
    document.body.style.overflow = ouvert ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [ouvert]);

  return (
    <>
      <button
        onClick={() => setOuvert(true)}
        aria-label="Ouvrir le menu"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line text-ink-soft transition-colors hover:bg-paper-2 hover:text-ink lg:hidden"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>

      {ouvert && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="animate-fade-in absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOuvert(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 max-w-[82vw] flex-col border-r border-line bg-card shadow-card-hover">
            <button
              onClick={() => setOuvert(false)}
              aria-label="Fermer le menu"
              className="absolute right-3 top-4 grid h-8 w-8 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-paper-2 hover:text-ink"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
            {children}
          </aside>
        </div>
      )}
    </>
  );
}
