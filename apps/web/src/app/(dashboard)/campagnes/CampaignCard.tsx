import { libelleDeclencheur } from "@/lib/declencheurs";
import { CampaignToggle } from "./CampaignRow";
import { CampaignActions, type CampaignFull } from "./CampaignActions";

export interface CampaignVue extends CampaignFull {
  envoyes: number;
  echecs: number;
  dernierEnvoi: string | null;
}

const dateCourte = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

/**
 * Une campagne dans la liste.
 *
 * L'ancienne version tenait sur une seule ligne : nom, pastille de statut, et
 * « déclencheur : nouveau_diplome » en chasse fixe. Trois défauts s'y
 * cumulaient.
 *
 * 1. Sur mobile, les trois actions occupaient 212 px des 343 disponibles et ne
 *    cédaient jamais un pixel : il ne restait que 97 px au nom de la campagne.
 * 2. « Envoyer maintenant », qui expédie de vrais emails sans retour possible,
 *    avait exactement l'apparence de « Modifier ».
 * 3. La ligne ne disait rien de ce qui compte : combien d'envois, quand, et
 *    avec quel sujet. Le recruteur devait ouvrir la fiche pour le découvrir.
 */
export function CampaignCard({ campagne, index }: { campagne: CampaignVue; index: number }) {
  const enPause = campagne.statut !== "actif";

  return (
    <div
      className="card animate-rise-in flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-[15px] font-semibold text-ink">{campagne.nom}</h3>
          <CampaignToggle id={campagne.id} statut={campagne.statut} />
        </div>

        {/* Le sujet réellement reçu par le candidat : c'est lui qui décide de
            l'ouverture du mail, il mérite mieux qu'un clic sur « Modifier ». */}
        <p className="mt-1 truncate text-[13px] text-ink-soft">
          <span className="text-ink-faint">Objet :</span> {campagne.sujet}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-faint">
          <span>{libelleDeclencheur(campagne.declencheur)}</span>
          <span>·</span>
          <span>1 relance max / {campagne.delaiMinRelanceJours} j</span>
          <span>·</span>
          <Bilan campagne={campagne} />
        </div>

        {enPause && (
          // Dit pourquoi rien ne part. Une pastille « Pause » seule laissait
          // croire à une panne.
          <p className="mt-2 text-[12px] text-ink-faint">
            En pause : aucun envoi automatique tant qu'elle n'est pas réactivée.
          </p>
        )}
      </div>

      <CampaignActions campagne={campagne} />
    </div>
  );
}

/** Bilan des envois, formulé pour un recruteur et non pour une base. */
function Bilan({ campagne }: { campagne: CampaignVue }) {
  if (campagne.envoyes === 0 && campagne.echecs === 0) {
    return <span>Aucun envoi</span>;
  }

  const quand = campagne.dernierEnvoi
    ? ` · dernier le ${dateCourte.format(new Date(campagne.dernierEnvoi))}`
    : "";

  return (
    <span>
      <strong className="font-semibold text-ink-soft">{campagne.envoyes}</strong> envoyé
      {campagne.envoyes > 1 ? "s" : ""}
      {campagne.echecs > 0 && (
        // Les échecs en rouge : un envoi qui n'aboutit pas est un candidat
        // jamais recontacté, pas un détail technique.
        <span className="text-danger">
          {" "}
          · {campagne.echecs} échec{campagne.echecs > 1 ? "s" : ""}
        </span>
      )}
      {quand}
    </span>
  );
}
