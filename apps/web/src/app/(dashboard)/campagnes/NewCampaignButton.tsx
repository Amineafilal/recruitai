"use client";

import { useState } from "react";
import { CampaignForm } from "@/components/CampaignForm";
import { createCampaign } from "./actions";

export function NewCampaignButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl bg-accent px-4 py-2 text-[14px] font-medium text-white transition-colors hover:bg-accent-ink"
      >
        + Nouvelle campagne
      </button>
      {open && <CampaignForm onSubmit={createCampaign} onClose={() => setOpen(false)} />}
    </>
  );
}
