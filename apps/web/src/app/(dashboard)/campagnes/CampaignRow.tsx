"use client";

import { useState } from "react";
import { setCampaignStatus } from "./actions";

export function CampaignToggle({ id, statut }: { id: string; statut: string }) {
  const [current, setCurrent] = useState(statut);
  const [pending, setPending] = useState(false);
  const actif = current === "actif";

  async function toggle() {
    const next = actif ? "pause" : "actif";
    setPending(true);
    try {
      await setCampaignStatus(id, next);
      setCurrent(next);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 ${
        actif
          ? "border-emerald/25 bg-emerald/10 text-emerald hover:bg-emerald/20"
          : "border-amber/25 bg-amber/10 text-amber hover:bg-amber/20"
      }`}
      title={actif ? "Mettre en pause" : "Activer"}
    >
      {pending ? "…" : actif ? "Actif" : "En pause"}
    </button>
  );
}
