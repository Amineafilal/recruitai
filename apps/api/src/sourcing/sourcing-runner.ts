import { Injectable, Logger } from "@nestjs/common";
import { and, eq, lt } from "drizzle-orm";
import { getAdminDb, withTenant, schema } from "@recruitai/db";
import { scoreCandidate } from "@recruitai/ai";
import { villesDuPoste, type JobCriteria } from "@recruitai/types";
import { ApifyService, QuotaScrapingEpuiseError } from "./apify.service.js";

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

  constructor(private readonly apify: ApifyService) {}

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
      ({ runId, items } = await this.apify.runActor(actorId, input));
    } catch (err) {
      if (err instanceof QuotaScrapingEpuiseError) {
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
      statutScoring: "ok" | "echec";
      scoringErreur: string | null;
      scoringJustification: string | null;
      scoringCriteres: unknown;
    }[] = [];

    let echecs = 0;
    for (const profil of items) {
      try {
        const { score, justification, criteres: detail } = await scoreCandidate({ criteres, profil });
        scored.push({
          profil,
          score,
          statutScoring: "ok",
          scoringErreur: null,
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
      `Sourcing auto terminé pour ${jobId}: ${scored.length - echecs} candidat(s) scoré(s)` +
        (echecs > 0 ? `, ${echecs} en échec de scoring (conservés).` : "."),
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
              statutScoring: "ok",
              scoringErreur: null,
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
              candidat.score === null
                ? `Score attribué après nouvelle tentative : ${score}/100`
                : `Score recalculé : ${candidat.score} → ${score}/100`,
            details: justification,
            meta: { avant: candidat.score, apres: score },
            auteurEmail: "agent IA",
          });
        });
        reussis += 1;
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
