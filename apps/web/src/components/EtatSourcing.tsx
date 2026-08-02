export type SourcingStatut = "en_cours" | "termine" | "echec";

const dateHeureFr = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Ce qu'affiche un poste sans aucun candidat.
 *
 * Trois situations très différentes se cachaient derrière le même écran
 * « L'agent IA source vos candidats… » : une recherche réellement en cours,
 * une recherche terminée qui n'a trouvé personne, et une recherche qui a
 * échoué. Les deux dernières laissaient le recruteur attendre indéfiniment un
 * résultat qui n'arriverait jamais.
 */
export function EtatSourcing({
  statut,
  message,
  quand,
}: {
  statut: SourcingStatut | null | undefined;
  message: string | null | undefined;
  quand: string | null | undefined;
}) {
  const horodatage = quand ? dateHeureFr.format(new Date(quand)) : null;

  if (statut === "echec") {
    return (
      <div className="card border-l-4 border-l-danger px-6 py-10 text-center">
        <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-danger-soft text-danger">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        </div>
        <p className="text-[17px] font-bold text-ink">La recherche n'a pas pu aboutir</p>
        <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-ink-soft">
          {message ?? "Une erreur technique a interrompu la recherche."}
        </p>
        {horodatage && <p className="mt-3 text-[12px] text-ink-faint">Dernière tentative : {horodatage}</p>}
      </div>
    );
  }

  if (statut === "termine") {
    return (
      <div className="card px-6 py-10 text-center">
        <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-paper-2 text-ink-faint">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" strokeLinecap="round" />
          </svg>
        </div>
        <p className="text-[17px] font-bold text-ink">Aucun candidat ne correspond</p>
        <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-ink-soft">
          La recherche a bien abouti, mais aucun profil ne réunit vos critères. Élargissez les villes,
          retirez une compétence trop rare, ou assouplissez la séniorité.
        </p>
        {horodatage && <p className="mt-3 text-[12px] text-ink-faint">Recherche terminée le {horodatage}</p>}
      </div>
    );
  }

  // « en_cours », ou aucun sourcing encore lancé : le chargement est légitime.
  return (
    <div className="card grid place-items-center px-6 py-16 text-center">
      <div className="mb-3 h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      <p className="font-display text-lg text-ink">L'agent IA source vos candidats…</p>
      <p className="mt-1 text-[14px] text-ink-soft">
        Le scraping et le scoring prennent environ une minute. Rafraîchissez la page.
      </p>
    </div>
  );
}
