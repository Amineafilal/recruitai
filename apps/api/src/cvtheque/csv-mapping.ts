/**
 * Les CSV exportés par les ATS du marché (Beetween, Recruitee, Talentsoft…)
 * n'ont aucun en-tête standard. On accepte donc plusieurs libellés courants
 * par champ plutôt que d'imposer un format unique au client.
 */
const HEADER_ALIASES: Record<string, string[]> = {
  email: ["email", "e-mail", "mail", "adresse email", "courriel"],
  prenom: ["prenom", "prénom", "first name", "firstname"],
  nom: ["nom", "last name", "lastname", "nom de famille"],
  telephone: ["telephone", "téléphone", "tel", "phone", "mobile"],
  linkedinUrl: ["linkedin", "linkedin url", "profil linkedin", "url linkedin"],
  poste: ["poste", "titre", "job title", "intitule", "intitulé", "fonction"],
  entreprise: ["entreprise", "société", "societe", "company", "employeur"],
  localisation: ["localisation", "ville", "location", "city", "région", "region"],
};

const COMBINING_MARKS = /[̀-ͯ]/g;

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().normalize("NFD").replace(COMBINING_MARKS, "");
}

/** Mappe les en-têtes bruts du CSV vers nos champs canoniques. */
export function buildHeaderMap(headers: string[]): Map<number, string> {
  const map = new Map<number, string>();
  headers.forEach((raw, index) => {
    const normalized = normalizeHeader(raw);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.some((alias) => normalizeHeader(alias) === normalized)) {
        map.set(index, field);
        return;
      }
    }
  });
  return map;
}

export interface ParsedContact {
  [key: string]: string | undefined;
}

export function rowToContact(row: string[], headerMap: Map<number, string>): ParsedContact {
  const contact: ParsedContact = {};
  headerMap.forEach((field, index) => {
    const value = row[index]?.trim();
    if (value) contact[field] = value;
  });
  return contact;
}

function normalizeLinkedinUrl(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "")
    .split("?")[0];
}

/**
 * Clé de dédoublonnage : email en priorité (identifiant le plus fiable),
 * sinon URL LinkedIn normalisée. Retourne null si la ligne n'a ni l'un ni
 * l'autre — elle est alors inexploitable pour de la relance et ignorée.
 */
export function dedupeKeyFor(contact: ParsedContact): string | null {
  if (contact.email) return `email:${contact.email.trim().toLowerCase()}`;
  if (contact.linkedinUrl) return `linkedin:${normalizeLinkedinUrl(contact.linkedinUrl)}`;
  return null;
}

/**
 * Fusionne deux occurrences d'un même contact. Les exports ATS contiennent
 * souvent des lignes partielles pour une même personne : écraser la fiche
 * entière avec la dernière ligne perdrait les champs qu'elle laisse vides.
 * On garde donc la valeur la plus récente champ par champ, sans jamais
 * remplacer une valeur existante par du vide.
 */
export function mergeContacts(existing: ParsedContact, incoming: ParsedContact): ParsedContact {
  const merged: ParsedContact = { ...existing };
  for (const [field, value] of Object.entries(incoming)) {
    if (value) merged[field] = value;
  }
  return merged;
}

/**
 * Devine le séparateur : les exports ATS français sont majoritairement en
 * point-virgule (convention Excel FR), mais on rencontre aussi la virgule et
 * la tabulation. On tranche sur la ligne d'en-tête, celle qui a le plus de
 * colonnes l'emporte.
 */
export function detectDelimiter(headerLine: string): string {
  const candidates = [";", ",", "\t"];
  let best = ";";
  let bestCount = 0;
  for (const candidate of candidates) {
    const count = headerLine.split(candidate).length;
    if (count > bestCount) {
      bestCount = count;
      best = candidate;
    }
  }
  return best;
}
