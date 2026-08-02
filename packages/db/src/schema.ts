import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  integer,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const planEnum = pgEnum("plan_id", ["starter", "growth", "scale", "enterprise"]);
export const userRoleEnum = pgEnum("user_role", ["admin", "recruteur"]);
export const jobStatusEnum = pgEnum("job_status", ["ouvert", "en_pause", "clos"]);
export const scrapeSourceEnum = pgEnum("scrape_source", ["linkedin", "indeed", "apec", "wttj"]);
export const scrapeStatusEnum = pgEnum("scrape_status", ["pending", "ingested", "normalized", "failed"]);
export const validationStatusEnum = pgEnum("validation_status", ["a_valider", "valide", "rejete"]);
/**
 * État technique du scoring, distinct de la décision humaine
 * (`validation_status`) : un profil peut être « scoring impossible » tout en
 * restant « à valider » par le recruteur.
 */
export const scoringStatusEnum = pgEnum("scoring_status", ["ok", "echec"]);
/**
 * Étapes du pipeline de recrutement. Remplace `validation_status`, qui ne
 * distinguait que « à valider / validé / rejeté » et ne permettait pas de
 * suivre un candidat de l'entretien jusqu'à l'embauche.
 */
/**
 * Types d'activité consignés sur un candidat. `email` couvre les envois hors
 * campagne : les campagnes de relance visent la CVthèque, pas les candidats
 * sourcés (voir outreach_messages.profile_id).
 */
export const activityTypeEnum = pgEnum("activity_type", ["score", "appel", "email", "autre"]);

export const pipelineStageEnum = pgEnum("pipeline_stage", [
  "source",
  "a_valider",
  "retenu",
  "entretien_planifie",
  "entretien_realise",
  "offre_envoyee",
  "embauche",
  "rejete",
]);
/**
 * Issue du dernier sourcing lancé sur un poste.
 *
 * `termine` avec zéro candidat et `echec` sont deux situations opposées que
 * l'interface confondait : elle affichait « recherche en cours » dans les deux
 * cas, laissant le recruteur attendre indéfiniment un résultat qui n'arriverait
 * jamais.
 */
export const sourcingStatutEnum = pgEnum("sourcing_statut", ["en_cours", "termine", "echec"]);

export const signalTypeEnum = pgEnum("signal_type", ["changement_poste", "nouveau_diplome", "activite"]);
export const consentTypeEnum = pgEnum("consent_type", ["contact_rgpd", "opt_out"]);
export const outreachStatusEnum = pgEnum("outreach_status", ["envoye", "echec", "bloque_opt_out"]);

export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  nom: text("nom").notNull(),
  plan: planEnum("plan").notNull().default("starter"),
  // Optionnel : ne sert que si un jour on rebranche un fournisseur d'identité
  // externe. Auth interne = ce champ reste null.
  clerkOrgId: text("clerk_org_id").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    // Auth interne : hash bcrypt du mot de passe.
    passwordHash: text("password_hash"),
    clerkUserId: text("clerk_user_id"),
    role: userRoleEnum("role").notNull().default("recruteur"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_unique_idx").on(table.email)],
);

/**
 * Jetons de réinitialisation de mot de passe.
 *
 * On stocke le SHA-256 du jeton, jamais le jeton lui-même : une fuite de la
 * base ne permet alors pas de prendre la main sur un compte, puisque le lien
 * envoyé par email ne peut pas être reconstitué depuis l'empreinte.
 */
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    // Horodatage d'utilisation : un jeton ne sert qu'une fois.
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("password_reset_tokens_hash_idx").on(table.tokenHash)],
);

/**
 * Invitations d'un recruteur à rejoindre une agence existante.
 *
 * Même principe de jeton haché que la réinitialisation de mot de passe :
 * accepter une invitation crée un compte, c'est donc une opération aussi
 * sensible qu'une connexion.
 */
export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: userRoleEnum("role").notNull().default("recruteur"),
    tokenHash: text("token_hash").notNull(),
    inviteParUserId: uuid("invite_par_user_id").references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    accepteAt: timestamp("accepte_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("invitations_hash_idx").on(table.tokenHash)],
);

export const jobs = pgTable("jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  criteres: jsonb("criteres").notNull(),
  statut: jobStatusEnum("statut").notNull().default("ouvert"),

  // --- Suivi du dernier sourcing --------------------------------------------
  // Null tant qu'aucune recherche n'a été lancée sur ce poste.
  sourcingStatut: sourcingStatutEnum("sourcing_statut"),
  sourcingAt: timestamp("sourcing_at", { withTimezone: true }),
  /** Raison lisible en cas d'échec, affichée telle quelle au recruteur. */
  sourcingMessage: text("sourcing_message"),
  /** Nombre de candidats rapportés par la dernière recherche aboutie. */
  sourcingCandidats: integer("sourcing_candidats"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rawScrapeResults = pgTable("raw_scrape_results", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  source: scrapeSourceEnum("source").notNull(),
  apifyRunId: text("apify_run_id").notNull(),
  payload: jsonb("payload").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  statut: scrapeStatusEnum("statut").notNull().default("pending"),
});

export const sourcingCandidates = pgTable("sourcing_candidates", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  source: scrapeSourceEnum("source").notNull(),
  /**
   * Null quand le scoring n'a pas abouti. Un score de 0 est une note réelle
   * (« hors sujet ») : le confondre avec un échec technique ferait écarter à
   * tort des profils que l'IA n'a simplement pas pu évaluer.
   */
  score: integer("score"),
  statutScoring: scoringStatusEnum("statut_scoring").notNull().default("ok"),
  /** Message d'erreur du dernier échec, pour diagnostic côté recruteur. */
  scoringErreur: text("scoring_erreur"),
  /** Nombre de tentatives, pour ne pas boucler indéfiniment sur un profil. */
  scoringTentatives: integer("scoring_tentatives").notNull().default(0),
  /** Synthèse rendue par l'IA — une à deux phrases affichées au recruteur. */
  scoringJustification: text("scoring_justification"),
  /**
   * Détail par critère : { competences: {note, commentaire}, ... }.
   * C'est ce qui rend la note explicable — sans lui, le recruteur n'a qu'un
   * chiffre brut qu'il ne peut ni vérifier ni contester.
   */
  scoringCriteres: jsonb("scoring_criteres"),
  /** Étape courante du pipeline — source de vérité depuis la migration 0006. */
  etape: pipelineStageEnum("etape").notNull().default("source"),
  /**
   * @deprecated Ancien statut, tenu synchronisé automatiquement à chaque
   * changement d'étape (voir statutValidationPour). Conservé le temps que le
   * pipeline soit éprouvé en usage réel, puis supprimé.
   */
  statutValidation: validationStatusEnum("statut_validation").notNull().default("a_valider"),
  profil: jsonb("profil").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Historique horodaté des changements d'étape.
 *
 * Sert de preuve de traitement (qui a rejeté ce candidat, et quand) et de
 * socle au futur module Timeline, qui agrégera ces événements avec les notes
 * et les emails envoyés.
 */
export const candidateStageEvents = pgTable("candidate_stage_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  candidateId: uuid("candidate_id")
    .notNull()
    .references(() => sourcingCandidates.id, { onDelete: "cascade" }),
  /** Null pour l'événement d'entrée dans le pipeline. */
  etapeAvant: pipelineStageEnum("etape_avant"),
  etapeApres: pipelineStageEnum("etape_apres").notNull(),
  // L'auteur passe à null si le collègue quitte l'agence, mais son email reste
  // lisible : un historique dont les auteurs s'effacent ne prouve plus rien.
  auteurUserId: uuid("auteur_user_id").references(() => users.id, { onDelete: "set null" }),
  auteurEmail: text("auteur_email").notNull(),
  commentaire: text("commentaire"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Notes libres d'un recruteur sur un candidat sourcé (compte-rendu d'appel,
 * prétentions, disponibilité…). L'auteur est dénormalisé en email en plus de
 * la FK : une note doit rester lisible même si le collègue quitte l'agence.
 */
export const candidateNotes = pgTable("candidate_notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  candidateId: uuid("candidate_id")
    .notNull()
    .references(() => sourcingCandidates.id, { onDelete: "cascade" }),
  auteurUserId: uuid("auteur_user_id").references(() => users.id, { onDelete: "set null" }),
  auteurEmail: text("auteur_email").notNull(),
  contenu: text("contenu").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Activités d'un candidat qui n'ont pas de table dédiée : changement de score,
 * appel téléphonique, email envoyé hors campagne.
 *
 * Les mouvements de pipeline (candidate_stage_events) et les notes
 * (candidate_notes) gardent leurs tables : elles ont des règles propres — un
 * mouvement est un journal immuable, une note est modifiable et supprimable
 * par son auteur. Tout regrouper ici ferait perdre cette distinction. La
 * timeline les fusionne à la lecture.
 */
export const candidateActivities = pgTable("candidate_activities", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  candidateId: uuid("candidate_id")
    .notNull()
    .references(() => sourcingCandidates.id, { onDelete: "cascade" }),
  type: activityTypeEnum("type").notNull(),
  /** Résumé lisible, affiché tel quel dans la timeline. */
  resume: text("resume").notNull(),
  /** Détail libre saisi par le recruteur (compte rendu d'appel). */
  details: text("details"),
  /** Données structurées propres au type : { avant, apres } pour un score. */
  meta: jsonb("meta"),
  // Null pour les activités générées par le système (re-scoring automatique).
  auteurUserId: uuid("auteur_user_id").references(() => users.id, { onDelete: "set null" }),
  auteurEmail: text("auteur_email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cvthequeProfiles = pgTable(
  "cvtheque_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    contact: jsonb("contact").notNull(),
    // Clé de dédoublonnage normalisée (email en minuscules, sinon URL LinkedIn
    // normalisée). Unique par tenant : ré-importer le même CSV met à jour les
    // fiches existantes au lieu de dupliquer la base.
    dedupeKey: text("dedupe_key").notNull(),
    // Jeton du lien de désinscription envoyé dans chaque email. Aléatoire et
    // non devinable : il identifie le candidat sans exposer d'ID interne et
    // sans permettre d'énumérer la base depuis un lien public.
    optOutToken: uuid("opt_out_token").defaultRandom().notNull().unique(),
    statutChaud: boolean("statut_chaud").notNull().default(false),
    prioriteScore: integer("priorite_score").notNull().default(0),
    dernierEnrichissementAt: timestamp("dernier_enrichissement_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("cvtheque_profiles_tenant_dedupe_idx").on(table.tenantId, table.dedupeKey)],
);

export const signals = pgTable("signals", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  profileId: uuid("profile_id").notNull().references(() => cvthequeProfiles.id, { onDelete: "cascade" }),
  type: signalTypeEnum("type").notNull(),
  detecteAt: timestamp("detecte_at", { withTimezone: true }).notNull().defaultNow(),
});

export const campaigns = pgTable("campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  nom: text("nom").notNull(),
  sujet: text("sujet").notNull(),
  // Corps du mail avec variables {{prenom}}, {{poste}}… (voir packages/ai ou
  // outreach/template.ts). Le lien de désinscription est ajouté à l'envoi,
  // il n'a pas à figurer dans le template.
  template: text("template").notNull(),
  // Type de signal qui déclenche la relance (signal_type) ou "manuel".
  declencheur: text("declencheur").notNull(),
  // Ne pas re-solliciter un même candidat plus souvent que ce délai.
  delaiMinRelanceJours: integer("delai_min_relance_jours").notNull().default(90),
  statut: text("statut").notNull().default("actif"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Traçabilité des envois : sert à l'anti-doublon (ne pas relancer deux fois
 * le même candidat) et à la preuve du traitement en cas de contrôle CNIL.
 */
export const outreachMessages = pgTable("outreach_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  profileId: uuid("profile_id").notNull().references(() => cvthequeProfiles.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  signalId: uuid("signal_id").references(() => signals.id, { onDelete: "set null" }),
  destinataire: text("destinataire").notNull(),
  sujet: text("sujet").notNull(),
  statut: outreachStatusEnum("statut").notNull().default("envoye"),
  erreur: text("erreur"),
  providerMessageId: text("provider_message_id"),
  envoyeAt: timestamp("envoye_at", { withTimezone: true }).notNull().defaultNow(),
});

export const consents = pgTable("consents", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  // Profil CVthèque concerné. Non contraint par FK vers cvtheque_profiles :
  // un opt-out doit survivre à la suppression de la fiche, sinon on
  // recontacterait la personne au prochain import du même CSV.
  candidateId: uuid("candidate_id").notNull(),
  // Copie de la clé de dédoublonnage (email/LinkedIn) pour pouvoir réappliquer
  // l'opt-out à une fiche recréée par un import ultérieur.
  dedupeKey: text("dedupe_key").notNull(),
  type: consentTypeEnum("type").notNull(),
  source: text("source").notNull().default("lien_email"),
  horodatage: timestamp("horodatage", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  acteur: text("acteur").notNull(),
  horodatage: timestamp("horodatage", { withTimezone: true }).notNull().defaultNow(),
});

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  plan: planEnum("plan").notNull(),
  statut: text("statut").notNull().default("actif"),
});

export const tenantScrapeUsage = pgTable(
  "tenant_scrape_usage",
  {
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    mois: text("mois").notNull(), // format "YYYY-MM"
    creditsUtilises: integer("credits_utilises").notNull().default(0),
    creditsPlafond: integer("credits_plafond").notNull(),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.mois] })],
);
