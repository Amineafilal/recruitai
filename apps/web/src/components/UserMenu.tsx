"use client";

import { useState } from "react";
import Link from "next/link";
import { logout } from "@/lib/auth-actions";

export function UserMenu({ email, agence }: { email: string; agence: string }) {
  const [open, setOpen] = useState(false);
  const initials = email.slice(0, 2).toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-paper-2"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-[12px] font-bold text-white">
          {initials}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-[13px] font-semibold leading-tight text-ink">{agence || "Mon agence"}</span>
          <span className="block max-w-[140px] truncate text-[11px] leading-tight text-ink-faint">{email}</span>
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-faint">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-[calc(100%+6px)] z-20 w-52 overflow-hidden rounded-xl border border-line bg-card shadow-card-hover">
            <div className="border-b border-line px-4 py-3">
              <p className="text-[13px] font-semibold text-ink">{agence}</p>
              <p className="truncate text-[12px] text-ink-faint">{email}</p>
            </div>
            <Link
              href="/profil"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 border-b border-line px-4 py-2.5 text-left text-[13px] font-medium text-ink-soft transition-colors hover:bg-paper-2 hover:text-ink"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Mon profil
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] font-medium text-danger transition-colors hover:bg-paper-2"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4|M16 17l5-5-5-5|M21 12H9" />
                </svg>
                Se déconnecter
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
