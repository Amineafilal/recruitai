/**
 * Jeu de démonstration de la CVthèque.
 *
 * Sert à montrer concrètement le mécanisme de détection des profils chauds à
 * une agence qui n'a pas encore importé son fichier. Chaque fiche porte
 * `contact.demo = true` : c'est le SEUL critère de suppression du jeu de
 * démo, pour qu'aucun contact réel ne puisse être effacé par ce bouton.
 */

export const MARQUEUR_DEMO = "demo";

interface ProfilDemo {
  contact: Record<string, unknown>;
  statutChaud: boolean;
  prioriteScore: number;
  /** Type de signal à créer, si le profil est chaud. */
  signal?: "changement_poste" | "nouveau_diplome";
  /** Ancienneté du dernier enrichissement, en jours. */
  enrichiIlYaJours?: number;
}

export const PROFILS_DEMO: ProfilDemo[] = [
  {
    contact: {
      demo: true,
      prenom: "Salma",
      nom: "Benali",
      email: "salma.benali@exemple-demo.ma",
      telephone: "+212 6 12 34 56 78",
      poste: "Directrice financière",
      entreprise: "Attijari Capital",
      localisation: "Casablanca",
      linkedinUrl: "https://www.linkedin.com/in/exemple-demo-salma",
      posteHistorique: "Contrôleuse de gestion senior",
    },
    statutChaud: true,
    prioriteScore: 92,
    signal: "changement_poste",
    enrichiIlYaJours: 2,
  },
  {
    contact: {
      demo: true,
      prenom: "Youssef",
      nom: "El Amrani",
      email: "youssef.elamrani@exemple-demo.ma",
      telephone: "+212 6 61 22 33 44",
      poste: "Ingénieur DevOps",
      entreprise: "OCP Group",
      localisation: "Casablanca",
      linkedinUrl: "https://www.linkedin.com/in/exemple-demo-youssef",
      diplome: "Certification AWS Solutions Architect",
    },
    statutChaud: true,
    prioriteScore: 78,
    signal: "nouveau_diplome",
    enrichiIlYaJours: 5,
  },
  {
    contact: {
      demo: true,
      prenom: "Nadia",
      nom: "Cherkaoui",
      email: "nadia.cherkaoui@exemple-demo.ma",
      poste: "Responsable RH",
      entreprise: "Maroc Telecom",
      localisation: "Rabat",
      linkedinUrl: "https://www.linkedin.com/in/exemple-demo-nadia",
    },
    statutChaud: false,
    prioriteScore: 40,
    enrichiIlYaJours: 12,
  },
  {
    contact: {
      demo: true,
      prenom: "Karim",
      nom: "Tazi",
      email: "karim.tazi@exemple-demo.ma",
      telephone: "+212 6 70 11 22 33",
      poste: "Développeur fullstack",
      entreprise: "Freelance",
      localisation: "Marrakech",
      linkedinUrl: "https://www.linkedin.com/in/exemple-demo-karim",
    },
    statutChaud: false,
    prioriteScore: 35,
    enrichiIlYaJours: 20,
  },
  {
    contact: {
      demo: true,
      prenom: "Imane",
      nom: "Fassi",
      poste: "Juriste d'affaires",
      entreprise: "Cabinet Bennani",
      localisation: "Casablanca",
      // Volontairement sans email : illustre un profil non relançable, et
      // pourquoi la tuile « relançables » diffère du total.
      linkedinUrl: "https://www.linkedin.com/in/exemple-demo-imane",
    },
    statutChaud: false,
    prioriteScore: 28,
  },
  {
    contact: {
      demo: true,
      prenom: "Omar",
      nom: "Bennis",
      email: "omar.bennis@exemple-demo.ma",
      poste: "Chef de projet SI",
      entreprise: "CIH Bank",
      localisation: "Casablanca",
      linkedinUrl: "https://www.linkedin.com/in/exemple-demo-omar",
    },
    statutChaud: false,
    prioriteScore: 45,
    enrichiIlYaJours: 8,
  },
];
