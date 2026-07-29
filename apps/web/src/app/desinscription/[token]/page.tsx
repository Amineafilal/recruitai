"use client";

import { useState } from "react";
import { use } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function DesinscriptionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [etat, setEtat] = useState<"initial" | "encours" | "fait" | "erreur">("initial");
  const [message, setMessage] = useState("");

  // Confirmation explicite plutôt qu'une désinscription au chargement : les
  // clients mail pré-visitent les liens, ce qui provoquerait des
  // désinscriptions que le candidat n'a jamais demandées.
  async function confirmer() {
    setEtat("encours");
    try {
      const response = await fetch(`${API_URL}/desinscription/${token}`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message ?? "Erreur");
      setMessage(body.message);
      setEtat("fait");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Une erreur est survenue.");
      setEtat("erreur");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-2xl font-semibold">Désinscription</h1>

      {etat === "fait" ? (
        <p className="text-green-700">{message}</p>
      ) : (
        <>
          <p className="text-slate-600">
            Confirmez que vous ne souhaitez plus recevoir de messages concernant des opportunités
            professionnelles.
          </p>
          <button
            onClick={confirmer}
            disabled={etat === "encours"}
            className="rounded-md bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
          >
            {etat === "encours" ? "Traitement…" : "Confirmer ma désinscription"}
          </button>
          {etat === "erreur" && <p className="text-red-600">{message}</p>}
        </>
      )}
    </main>
  );
}
