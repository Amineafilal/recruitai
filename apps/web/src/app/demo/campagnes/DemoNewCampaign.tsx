"use client";

import { useState } from "react";
import { CampaignForm } from "@/components/CampaignForm";

/** Bouton démo : ouvre le vrai formulaire mais simule le succès (pas d'API). */
export function DemoNewCampaign() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl bg-accent px-4 py-2 text-[14px] font-medium text-white transition-colors hover:bg-accent-ink"
      >
        + Nouvelle campagne
      </button>
      {open && (
        <CampaignForm
          onSubmit={async () => {
            await new Promise((r) => setTimeout(r, 500));
            return { ok: true };
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
