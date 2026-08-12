import Link from "next/link";

/**
 * Checklist de démarrage, affichée tant que le compte n'est pas opérationnel.
 *
 * Un compte neuf ouvre sur un tableau de bord à zéro, sans rien indiquer de ce
 * qu'il faut faire. La CVthèque, en particulier, reste vide chez presque tout
 * le monde — alors que c'est elle qui alimente les relances, donc la moitié de
 * la valeur du produit.
 *
 * Les étapes sont déduites de l'état RÉEL du compte, jamais d'un drapeau
 * « onboarding terminé » : un tel drapeau se désynchronise dès qu'un recruteur
 * supprime son unique poste, et la checklist affirmerait alors le contraire de
 * ce que l'écran montre.
 *
 * Elle disparaît entièrement une fois les trois étapes franchies : une
 * checklist qui reste après coup devient du décor, et on cesse de la lire.
 */
export function DemarrageChecklist({
  postes,
  profilsCvtheque,
  campagnesActives,
}: {
  postes: number;
  profilsCvtheque: number;
  campagnesActives: number;
}) {
  const etapes = [
    {
      faite: postes > 0,
      titre: "Créer votre premier poste",
      texte: "L'agent lance une recherche dès la création et vous livre une shortlist notée.",
      href: "/postes",
      action: "Créer un poste",
    },
    {
      faite: profilsCvtheque > 0,
      titre: "Importer votre CVthèque",
      texte:
        "Vos CV dorment dans un fichier. Importés ici, ils sont surveillés et relancés au bon moment.",
      href: "/cvtheque",
      action: "Importer un CSV",
    },
    {
      faite: campagnesActives > 0,
      titre: "Activer une campagne de relance",
      texte: "Un message, un déclencheur, et les candidats redevenus intéressants sont recontactés.",
      href: "/campagnes",
      action: "Créer une campagne",
    },
  ];

  const restantes = etapes.filter((e) => !e.faite);
  if (restantes.length === 0) return null;

  const faites = etapes.length - restantes.length;
  const suivante = restantes[0];

  return (
    <section className="card mb-6 p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-[15px] font-semibold text-ink">Pour démarrer</h2>
        <span className="text-[13px] text-ink-faint">
          {faites} sur {etapes.length} — il reste {restantes.length} étape
          {restantes.length > 1 ? "s" : ""}
        </span>
      </div>

      <ol className="flex flex-col gap-3">
        {etapes.map((e) => (
          <li key={e.titre} className="flex items-start gap-3">
            <span
              aria-hidden
              className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[11px] font-bold ${
                e.faite
                  ? "border-emerald bg-emerald text-white"
                  : "border-line bg-paper-2 text-ink-faint"
              }`}
            >
              {e.faite ? "✓" : ""}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={`text-[14px] font-medium ${
                  e.faite ? "text-ink-faint line-through" : "text-ink"
                }`}
              >
                {e.titre}
              </p>
              {!e.faite && (
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink-soft">{e.texte}</p>
              )}
            </div>
            {/* Une seule action mise en avant : celle qui vient. Trois boutons
                d'égale importance laisseraient le recruteur choisir par quoi
                commencer, ce qui est précisément ce qu'il ne sait pas. */}
            {!e.faite && e === suivante && (
              <Link
                href={e.href}
                className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-accent-ink"
              >
                {e.action}
              </Link>
            )}
            {!e.faite && e !== suivante && (
              <Link
                href={e.href}
                className="shrink-0 text-[13px] font-medium text-ink-faint transition-colors hover:text-accent"
              >
                {e.action}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
