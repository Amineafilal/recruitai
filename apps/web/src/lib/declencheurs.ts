/**
 * Déclencheurs de campagne, côté affichage.
 *
 * Ce module n'a volontairement PAS de directive "use client" : il est lu à la
 * fois par le formulaire (composant client) et par la liste des campagnes
 * (composant serveur). Placées dans CampaignForm.tsx, ces valeurs étaient
 * inaccessibles au serveur — Next n'expose d'un module client que la frontière
 * du composant, et l'import d'une fonction ordinaire y renvoie undefined.
 */
export const TRIGGERS: { value: string; label: string }[] = [
  { value: "manuel", label: "Manuel — tous les candidats chauds" },
  { value: "changement_poste", label: "Changement de poste détecté" },
  { value: "nouveau_diplome", label: "Nouveau diplôme" },
  { value: "activite", label: "Activité LinkedIn récente" },
];

/**
 * Libellé lisible d'un déclencheur. La liste des campagnes affichait la valeur
 * brute de la base — « nouveau_diplome » en chasse fixe — alors que le
 * formulaire proposait déjà une phrase en français. Le recruteur voyait deux
 * vocabulaires pour la même chose.
 */
export function libelleDeclencheur(valeur: string): string {
  return TRIGGERS.find((t) => t.value === valeur)?.label ?? valeur;
}
