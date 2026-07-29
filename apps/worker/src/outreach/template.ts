import { TEMPLATE_VARIABLES } from "@recruitai/types";

/** Échappe le HTML : les valeurs viennent de CSV clients, jamais de confiance. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Remplace {{variable}} par la donnée du contact. Une variable inconnue ou
 * sans valeur est remplacée par une chaîne vide plutôt que laissée telle
 * quelle : mieux vaut une phrase incomplète qu'un "{{prenom}}" brut envoyé
 * à un candidat.
 */
export function renderTemplate(template: string, contact: Record<string, unknown>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, name: string) => {
    if (!(TEMPLATE_VARIABLES as readonly string[]).includes(name)) return "";
    const value = contact[name];
    return typeof value === "string" ? escapeHtml(value) : "";
  });
}

/**
 * Le lien de désinscription est ajouté par le système, pas par le template :
 * l'opt-out est une obligation RGPD, il ne doit pas pouvoir être oublié ou
 * retiré par un recruteur qui édite sa campagne.
 */
export function appendOptOutFooter(html: string, optOutUrl: string): string {
  return `${html}
<hr />
<p style="font-size:12px;color:#666">
  Vous recevez ce message car votre profil figure dans notre base de candidats.
  <a href="${optOutUrl}">Je ne souhaite plus être contacté</a>.
</p>`;
}
