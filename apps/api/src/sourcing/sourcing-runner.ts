import { Injectable, Logger } from "@nestjs/common";
import { and, eq, lt } from "drizzle-orm";
import { getAdminDb, withTenant, schema } from "@recruitai/db";
import { scoreCandidate } from "@recruitai/ai";
import { villesDuPoste, type JobCriteria } from "@recruitai/types";
import {
  ApifyService,
  QuotaScrapingEpuiseError,
  ScrapingIndisponibleError,
} from "./apify.service.js";
import { normaliserProfil } from "./normaliser-profil.js";

/**
 * Écart minimal entre deux recherches, quelle que soit leur provenance.
 *
 * La source interroge les résultats publics d'un moteur de recherche : quatre
 * recherches en trois minutes suffisent à se faire mettre de côté, et les runs
 * suivants expirent alors sans extraire une seule ligne. Constaté en
 * production le 7 août : cinq recherches abouties, puis quatre TIMED-OUT
 * d'affilée dès que deux boucles de sourcing se sont chevauchées.
 */
const ECART_MINIMAL_ENTRE_RECHERCHES_MS = 30_000;

/**
 * Sourcing exécuté EN LIGNE dans l'API, sans worker BullMQ persistant. Choix
 * volontaire : un worker 24/7 sonderait Redis en continu et viderait le quota
 * Upstash gratuit même à vide.
 *
 * Deux déclencheurs :
 *  - à la création d'un poste (runInBackground, réponse HTTP immédiate) ;
 *  - chaque matin à 06:00 sur tous les postes ouverts, via SchedulerService.
 */

@Injectable()
export class SourcingRunner {
  private readonly logger = new Logger(SourcingRunner.name);

  /**
   * File d'attente unique de toutes les recherches du processus.
   *
   * Le cron sérialise déjà ses propres postes, mais rien ne l'empêchait de se
   * chevaucher avec un sourcing déclenché à la création d'un poste ou à la
   * main. Les recherches partaient alors par deux, la source coupait, et les
   * deux postes échouaient — dont celui que le recruteur venait de créer.
   */
  private static file: Promise<void> = Promise.resolve();
  private static finDeLaDerniereRecherche = 0;

  constructor(private readonly apify: ApifyService) {}

  /** Exécute `travail` seul, et jamais moins de 30 s après la recherche précédente. */
  private static enfiler<T>(travail: () => Promise<T>): Promise<T> {
    const resultat = SourcingRunner.file.then(async () => {
      const depuis = Date.now() - SourcingRunner.finDeLaDerniereRecherche;
      const reste = ECART_MINIMAL_ENTRE_RECHERCHES_MS - depuis;
      if (reste > 0) await new Promise((r) => setTimeout(r, reste));
      try {
        return await travail();
      } finally {
        SourcingRunner.finDeLaDerniereRecherche = Date.now();
      }
    });
    // La file ne doit pas se rompre sur un échec : le poste suivant a encore
    // besoin d'être traité.
    SourcingRunner.file = resultat.then(
      () => undefined,
      () => undefined,
    );
    return resultat;
  }

  /**
   * Consigne l'issue du dernier sourcing sur le poste.
   *
   * Sans cette trace, l'interface ne peut pas distinguer « recherche en cours »
   * de « terminée sans résultat » ni de « échec » — elle affichait donc un
   * chargement perpétuel dans les trois cas.
   */
  private async marquer(
    tenantId: string,
    jobId: string,
    statut: "en_cours" | "termine" | "echec",
    details: { message?: string | null; candidats?: number | null } = {},
  ): Promise<void> {
    await withTenant(tenantId, (tx) =>
      tx
        .update(schema.jobs)
        .set({
          sourcingStatut: statut,
          sourcingAt: new Date(),
          sourcingMessage: details.message ?? null,
          sourcingCandidats: details.candidats ?? null,
        })
        .where(eq(schema.jobs.id, jobId)),
    ).catch((err) => {
      // Le suivi ne doit jamais faire échouer le sourcing lui-même.
      this.logger.warn(`Suivi du sourcing non enregistré (poste ${jobId}) : ${String(err)}`);
    });
  }

  /** Lance le sourcing d'un poste en tâche de fond (fire-and-forget). */
  runInBackground(tenantId: string, jobId: string): void {
    this.sourcePoste(tenantId, jobId).catch((err) => {
      this.logger.error(`Sourcing auto échoué (tenant ${tenantId}, job ${jobId}): ${String(err)}`);
    });
  }

  /** Sourcing d'un poste, attendu jusqu'au bout. Appelé par le scheduler. */
  async sourcePoste(tenantId: string, jobId: string): Promise<void> {
    const actorId = this.apify.actorId("linkedin");
    if (!this.apify.token() || !actorId) {
      this.logger.warn("APIFY_TOKEN ou APIFY_LINKEDIN_ACTOR_ID absent — sourcing auto ignoré.");
      return;
    }

    const criteres = await withTenant(tenantId, async (tx) => {
      const [row] = await tx.select().from(schema.jobs).where(eq(schema.jobs.id, jobId));
      return row?.criteres as JobCriteria | undefined;
    });
    if (!criteres) return;

    // L'actor accepte plusieurs villes en une seule exécution : on les passe
    // toutes d'un coup plutôt que de lancer un run par ville, ce qui
    // multiplierait le coût et le quota consommé.
    const villes = villesDuPoste(criteres);

    const max = Number(process.env.APIFY_MAX_PROFILES_PER_SEARCH ?? 15);
    const input = {
      searchQuery: [criteres.titre, ...(criteres.competences ?? [])].join(" ").trim(),
      currentJobTitles: [criteres.titre],
      ...(villes.length > 0 ? { locations: villes } : {}),
      profileScraperMode: this.apify.modeScraping(),
      maxItems: max,
    };

    this.logger.log(
      `Sourcing auto démarré pour le poste ${jobId} (${criteres.titre}${
        villes.length ? ` — ${villes.join(", ")}` : ""
      })`,
    );
    await this.marquer(tenantId, jobId, "en_cours");
    let runId: string;
    let items: unknown[];
    try {
      ({ runId, items } = await SourcingRunner.enfiler(() => this.apify.runActor(actorId, input)));
    } catch (err) {
      if (err instanceof ScrapingIndisponibleError) {
        this.logger.error(
          `Sourcing du poste ${jobId} abandonné après plusieurs tentatives : ${err.message}`,
        );
        await this.marquer(tenantId, jobId, "echec", {
          message:
            "La source de profils n'a pas répondu, malgré plusieurs tentatives. " +
            "C'est passager : relancez la recherche dans quelques minutes.",
        });
      } else if (err instanceof QuotaScrapingEpuiseError) {
        // Journalisé en ERROR et non en WARN : sans quota, la promesse
        // centrale du produit — une shortlist chaque matin — ne tient plus.
        this.logger.error(
          `Sourcing impossible pour le poste ${jobId} : ${err.message} ` +
            `Vérifier le plan Apify ou changer d'actor.`,
        );
        await this.marquer(tenantId, jobId, "echec", {
          message:
            "Le quota de scraping du compte est épuisé : aucune recherche ne peut aboutir. " +
            "Contactez l'administrateur de votre espace.",
        });
      } else {
        // Le détail technique brut n'a pas sa place à l'écran, mais il doit
        // exister quelque part : sans lui, diagnostiquer imposait de fouiller
        // les journaux du serveur.
        this.logger.error(`Sourcing du poste ${jobId} échoué : ${String(err)}`);
        await this.marquer(tenantId, jobId, "echec", {
          message: "La recherche a échoué pour une raison technique. Réessayez dans un moment.",
        });
      }
      throw err;
    }

    const rawId = await withTenant(tenantId, async (tx) => {
      const [r] = await tx
        .insert(schema.rawScrapeResults)
        .values({ tenantId, source: "linkedin", apifyRunId: runId, payload: items, statut: "ingested" })
        .returning({ id: schema.rawScrapeResults.id });
      return r.id;
    });

    // Scoring HORS transaction (appels réseau Mistral), puis écriture courte.
    //
    // Un échec de scoring n'écarte PAS le candidat : il est enregistré sans
    // note, avec la raison de l'échec. Le jeter ferait perdre silencieusement
    // un profil peut-être excellent sur un simple timeout réseau, sans que le
    // recruteur puisse jamais s'en rendre compte.
    const scored: {
      profil: unknown;
      score: number | null;
      statutScoring: "ok" | "echec" | "non_evaluable";
      scoringErreur: string | null;
      scoringJustification: string | null;
      scoringCriteres: unknown;
    }[] = [];

    // Normalisation immédiate : le scoring et la fiche candidat ne doivent
    // pas connaître le vocabulaire de l'actor qui a produit les données.
    const profils = items.map(normaliserProfil);

    let echecs = 0;
    let nonEvaluables = 0;
    for (const profil of profils) {
      try {
        const { score, justification, criteres: detail } = await scoreCandidate({ criteres, profil });
        // score null : l'IA a répondu, mais aucun critère n'était évaluable.
        // On le dit, plutôt que de le classer dernier avec un 0 mensonger.
        if (score === null) nonEvaluables += 1;
        scored.push({
          profil,
          score,
          statutScoring: score === null ? "non_evaluable" : "ok",
          scoringErreur:
            score === null
              ? "Profil trop incomplet pour être noté : la source n'a renvoyé aucune donnée exploitable."
              : null,
          scoringJustification: justification,
          scoringCriteres: detail,
        });
      } catch (err) {
        echecs += 1;
        this.logger.warn(`Scoring d'un profil échoué, candidat conservé sans note: ${String(err)}`);
        scored.push({
          profil,
          score: null,
          statutScoring: "echec",
          scoringErreur: resumeErreurScoring(err),
          scoringJustification: null,
          scoringCriteres: null,
        });
      }
    }

    await withTenant(tenantId, async (tx) => {
      if (scored.length > 0) {
        await tx.insert(schema.sourcingCandidates).values(
          scored.map((c) => ({
            tenantId,
            jobId,
            source: "linkedin" as const,
            score: c.score,
            statutScoring: c.statutScoring,
            scoringErreur: c.scoringErreur,
            scoringJustification: c.scoringJustification,
            scoringCriteres: c.scoringCriteres,
            scoringTentatives: 1,
            profil: c.profil,
            statutValidation: "a_valider" as const,
          })),
        );
      }
      await tx
        .update(schema.rawScrapeResults)
        .set({ statut: "normalized" })
        .where(eq(schema.rawScrapeResults.id, rawId));
    });

    await this.marquer(tenantId, jobId, "termine", { candidats: scored.length });

    this.logger.log(
      `Sourcing auto terminé pour ${jobId}: ${scored.length - echecs - nonEvaluables} candidat(s) scoré(s)` +
        (echecs > 0 ? `, ${echecs} en échec de scoring (conservés)` : "") +
        (nonEvaluables > 0 ? `, ${nonEvaluables} profil(s) trop incomplet(s) pour être noté(s)` : "") +
        ".",
    );
  }

  /**
   * Réessaie de noter les candidats dont le scoring a échoué.
   *
   * Appelé après le sourcing quotidien et déclenchable à la main. Le compteur
   * de tentatives borne les réessais : un profil que l'IA n'arrive
   * définitivement pas à traiter ne doit pas être relancé chaque nuit.
   */
  async rescorerEchecs(tenantId: string, maxTentatives = 3): Promise<{ traites: number; reussis: number }> {
    const enEchec = await withTenant(tenantId, (tx) =>
      tx
        .select()
        .from(schema.sourcingCandidates)
        .where(
          and(
            eq(schema.sourcingCandidates.tenantId, tenantId),
            eq(schema.sourcingCandidates.statutScoring, "echec"),
            lt(schema.sourcingCandidates.scoringTentatives, maxTentatives),
          ),
        )
        .limit(50),
    );
    if (enEchec.length === 0) return { traites: 0, reussis: 0 };

    // Les critères sont relus par poste, une seule fois pour tout le lot.
    const criteresParJob = new Map<string, JobCriteria>();
    let reussis = 0;

    for (const candidat of enEchec) {
      let criteres = criteresParJob.get(candidat.jobId);
      if (!criteres) {
        criteres = await withTenant(tenantId, async (tx) => {
          const [row] = await tx.select().from(schema.jobs).where(eq(schema.jobs.id, candidat.jobId));
          return row?.criteres as JobCriteria | undefined;
        });
        if (!criteres) continue;
        criteresParJob.set(candidat.jobId, criteres);
      }

      try {
        const { score, justification, criteres: detail } = await scoreCandidate({
          criteres,
          profil: candidat.profil,
        });
        await withTenant(tenantId, async (tx) => {
          await tx
            .update(schema.sourcingCandidates)
            .set({
              score,
              // Un réessai peut aboutir sans pour autant produire une note :
              // le profil lui-même n'a rien à noter. L'enregistrer « ok »
              // avec un score vide le remettrait dans la file des échecs à
              // chaque nuit.
              statutScoring: score === null ? "non_evaluable" : "ok",
              scoringErreur:
                score === null
                  ? "Profil trop incomplet pour être noté : la source n'a renvoyé aucune donnée exploitable."
                  : null,
              scoringJustification: justification,
              scoringCriteres: detail,
              scoringTentatives: candidat.scoringTentatives + 1,
            })
            .where(eq(schema.sourcingCandidates.id, candidat.id));

          // Trace dans la timeline : un score qui change tout seul sans
          // explication ferait douter le recruteur de la fiabilité de l'outil.
          await tx.insert(schema.candidateActivities).values({
            tenantId,
            candidateId: candidat.id,
            type: "score",
            resume:
              score === null
                ? "Nouvelle tentative : profil trop incomplet pour être noté."
                : candidat.score === null
                  ? `Score attribué après nouvelle tentative : ${score}/100`
                  : `Score recalculé : ${candidat.score} → ${score}/100`,
            details: justification,
            meta: { avant: candidat.score, apres: score },
            auteurEmail: "agent IA",
          });
        });
        // Un profil déclaré non notable est résolu, pas récupéré : le compter
        // comme une réussite gonflerait artificiellement le rapport du cron.
        if (score !== null) reussis += 1;
      } catch (err) {
        await withTenant(tenantId, (tx) =>
          tx
            .update(schema.sourcingCandidates)
            .set({
              scoringErreur: resumeErreurScoring(err),
              scoringTentatives: candidat.scoringTentatives + 1,
            })
            .where(eq(schema.sourcingCandidates.id, candidat.id)),
        );
      }
    }

    this.logger.log(`Re-scoring tenant ${tenantId} : ${reussis}/${enEchec.length} récupéré(s).`);
    return { traites: enEchec.length, reussis };
  }

  /** Re-scoring de toutes les agences, pour le cron. */
  async rescorerToutesLesAgences(): Promise<{ traites: number; reussis: number }> {
    const tenants = await getAdminDb().select({ id: schema.tenants.id }).from(schema.tenants);
    let traites = 0;
    let reussis = 0;
    for (const tenant of tenants) {
      try {
        const r = await this.rescorerEchecs(tenant.id);
        traites += r.traites;
        reussis += r.reussis;
      } catch (err) {
        this.logger.error(`Re-scoring échoué (tenant ${tenant.id}) : ${String(err)}`);
      }
    }
    return { traites, reussis };
  }
}

/**
 * Message court et lisible par un recruteur. L'erreur brute du fournisseur
 * (stack, JSON) n'a aucun sens dans une interface de recrutement.
 */
function resumeErreurScoring(err: unknown): string {
  const brut = String(err);
  if (/429|rate.?limit/i.test(brut)) return "Limite de débit de l'IA atteinte.";
  if (/timeout|ETIMEDOUT|ECONNRESET/i.test(brut)) return "Délai dépassé lors de l'appel à l'IA.";
  if (/401|403|api.?key/i.test(brut)) return "Clé d'API de scoring invalide ou expirée.";
  if (/No scoring provider/i.test(brut)) return "Aucun moteur de scoring configuré.";
  if (/json|parse|schema/i.test(brut)) return "Réponse de l'IA illisible.";
  return "Échec technique du scoring.";
}
