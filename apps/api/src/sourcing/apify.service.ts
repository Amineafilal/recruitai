import { Injectable, Logger } from "@nestjs/common";

const APIFY_API_BASE = "https://api.apify.com/v2";
const TERMINAL = new Set(["SUCCEEDED", "FAILED", "TIMED-OUT", "ABORTED"]);

interface ApifyRun {
  id: string;
  status: string;
  defaultDatasetId: string;
  /**
   * Message du fournisseur. Décisif : un actor qui a épuisé son quota gratuit
   * renvoie SUCCEEDED avec zéro résultat, indiscernable d'une recherche sans
   * candidat. Seul ce champ dit la différence.
   */
  statusMessage?: string | null;
}

/**
 * Motifs signalant un arrêt pour cause de quota et non de résultat vide.
 * Le message exact dépend de l'auteur de l'actor, d'où la détection large.
 */
const MOTIFS_QUOTA = /limit reached|run limit|quota|upgrade to a paid|exceeded/i;

/**
 * Modes acceptés par harvestapi/linkedin-profile-search, du moins au plus cher.
 * Une valeur hors de cette liste ferait échouer chaque run — mieux vaut
 * retomber sur le mode économique que de ne rien sourcer du tout.
 */
const MODES_VALIDES = ["Short", "Full", "Full + email search"] as const;
export type ModeScraping = (typeof MODES_VALIDES)[number];

/** Levée quand l'actor s'est arrêté faute de quota, pas faute de candidats. */
export class QuotaScrapingEpuiseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuotaScrapingEpuiseError";
  }
}

/**
 * Levée quand le run n'a pas abouti pour une raison PASSAGÈRE : délai dépassé,
 * plantage de l'actor, source qui refuse temporairement de répondre.
 *
 * Distincte du quota épuisé, car l'issue n'est pas la même : ici, réessayer
 * plus tard fonctionne. Les confondre a conduit à annoncer au recruteur un
 * « quota épuisé » alors que le compte n'avait consommé que 0,69 $ sur 5 $.
 */
export class ScrapingIndisponibleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScrapingIndisponibleError";
  }
}

/**
 * Client Apify partagé par le sourcing de postes et l'enrichissement CVthèque.
 *
 * Un run Apify est asynchrone : on le démarre, puis on interroge son statut
 * jusqu'à un état terminal avant de lire le dataset. Le délai maximum évite
 * qu'un actor bloqué retienne indéfiniment une tâche planifiée.
 */
@Injectable()
export class ApifyService {
  private readonly logger = new Logger(ApifyService.name);

  /** Jeton API, ou null si le scraping n'est pas configuré sur cette instance. */
  token(): string | null {
    return process.env.APIFY_TOKEN ?? null;
  }

  actorId(source = "linkedin"): string | null {
    return process.env[`APIFY_${source.toUpperCase()}_ACTOR_ID`] ?? null;
  }

  /**
   * Mode de scraping configuré, validé. « Short » par défaut : c'est le moins
   * cher, et il ne faut jamais qu'une faute de frappe fasse basculer sur un
   * mode facturé au profil à l'insu de l'exploitant.
   */
  modeScraping(): ModeScraping {
    const brut = (process.env.APIFY_LINKEDIN_MODE ?? "").trim();
    if ((MODES_VALIDES as readonly string[]).includes(brut)) return brut as ModeScraping;
    if (brut) {
      this.logger.warn(
        `APIFY_LINKEDIN_MODE="${brut}" invalide — valeurs acceptées : ` +
          `${MODES_VALIDES.map((m) => `"${m}"`).join(", ")}. Repli sur "Short".`,
      );
    }
    return "Short";
  }

  /**
   * Durée accordée au run côté Apify. Le défaut de l'actor est de 180 s :
   * insuffisant dès que la recherche porte sur plusieurs villes, et le run est
   * alors tué sans avoir produit la moindre ligne (« Nothing extracted yet »).
   */
  private static readonly RUN_TIMEOUT_SECS = 420;

  /**
   * Attentes avant nouvelle tentative. Croissantes : la cause habituelle est
   * une source qui nous refuse temporairement l'accès après plusieurs
   * recherches rapprochées — la seule chose qui aide est de la laisser
   * respirer.
   */
  private static readonly ATTENTES_AVANT_REESSAI = [45_000, 120_000] as const;

  /**
   * Lance l'actor et rend ses résultats, en réessayant les échecs passagers.
   *
   * Un quota épuisé n'est jamais réessayé : la tentative suivante échouerait
   * à l'identique, en faisant seulement attendre le recruteur plus longtemps.
   */
  async runActor<T = unknown>(
    actorId: string,
    input: unknown,
    timeoutMs = 10 * 60 * 1000,
  ): Promise<{ runId: string; items: T[] }> {
    const tentatives = ApifyService.ATTENTES_AVANT_REESSAI.length + 1;

    for (let essai = 1; ; essai++) {
      try {
        return await this.executerUnRun<T>(actorId, input, timeoutMs);
      } catch (err) {
        const attente = ApifyService.ATTENTES_AVANT_REESSAI[essai - 1];
        if (!(err instanceof ScrapingIndisponibleError) || attente === undefined) throw err;
        this.logger.warn(
          `${err.message} Nouvelle tentative dans ${attente / 1000} s (${essai}/${tentatives}).`,
        );
        await new Promise((r) => setTimeout(r, attente));
      }
    }
  }

  /**
   * Appel réseau à Apify, dont les pannes de transport sont réessayables.
   *
   * `fetch` ne lève pas sur un code HTTP d'erreur : il ne lève que si la
   * connexion elle-même a échoué — DNS momentanément muet, coupure Wi-Fi,
   * pare-feu. Node emballe alors la cause réelle dans un `TypeError: fetch
   * failed` sans le moindre détail. Non traduite, cette erreur remontait
   * telle quelle et faisait échouer définitivement un sourcing que la
   * tentative suivante aurait mené à bien — constaté le 11 août à 21:16,
   * alors qu'Apify répondait normalement quelques minutes plus tard.
   *
   * Le délai borné évite l'autre issue : une connexion à demi ouverte qui
   * retient le sourcing indéfiniment, sans erreur ni résultat.
   */
  private async appeler(
    url: string,
    init?: RequestInit,
    /**
     * Nombre de reprises immédiates. Réservé aux LECTURES : les rejouer est
     * sans conséquence. Le démarrage d'un run garde 0 — si la requête a
     * atteint Apify mais que la réponse s'est perdue, la rejouer lancerait un
     * second run facturé, et dupliquerait les candidats.
     */
    reprises = 0,
  ): Promise<Response> {
    for (let essai = 0; ; essai++) {
      try {
        return await fetch(url, { ...init, signal: AbortSignal.timeout(60_000) });
      } catch (err) {
        const cause = (err as { cause?: { code?: string } })?.cause?.code;
        const raison = cause ?? (err as Error).name ?? "erreur réseau";
        if (essai >= reprises) throw new ScrapingIndisponibleError(`Apify injoignable (${raison}).`);
        this.logger.warn(`Apify injoignable (${raison}) — reprise immédiate ${essai + 1}/${reprises}.`);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  private async executerUnRun<T>(
    actorId: string,
    input: unknown,
    timeoutMs: number,
  ): Promise<{ runId: string; items: T[] }> {
    const token = this.token();
    if (!token) throw new Error("APIFY_TOKEN is not set");

    const start = await this.appeler(
      `${APIFY_API_BASE}/acts/${actorId}/runs?token=${token}&timeout=${ApifyService.RUN_TIMEOUT_SECS}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    // 5xx : panne côté fournisseur, réessayer a du sens. 4xx : jeton ou
    // requête invalides, réessayer donnerait exactement la même réponse.
    if (start.status >= 500) {
      throw new ScrapingIndisponibleError(`Apify a répondu ${start.status} au démarrage du run.`);
    }
    if (!start.ok) throw new Error(`Apify start ${start.status}: ${await start.text()}`);
    const run = ((await start.json()) as { data: ApifyRun }).data;

    const deadline = Date.now() + timeoutMs;
    let cur = run;
    while (!TERMINAL.has(cur.status)) {
      if (Date.now() > deadline) throw new Error(`Apify run ${run.id} timeout`);
      await new Promise((r) => setTimeout(r, 5000));
      // Une coupure pendant la surveillance ne doit pas faire perdre un run
      // qui tourne peut-être très bien : on repasse simplement au sondage
      // suivant, la boucle est déjà bornée par `deadline`.
      const res = await this.appeler(
        `${APIFY_API_BASE}/actor-runs/${run.id}?token=${token}`,
        undefined,
        2,
      ).catch((err: unknown) => {
        this.logger.warn(`Sondage du run ${run.id} échoué, nouvelle lecture dans 5 s : ${String(err)}`);
        return null;
      });
      if (!res) continue;
      cur = ((await res.json()) as { data: ApifyRun }).data;
    }
    if (cur.status !== "SUCCEEDED") {
      const detail = cur.statusMessage ? ` (« ${cur.statusMessage} »)` : "";
      // TIMED-OUT et FAILED sont passagers ; ABORTED est un arrêt humain
      // délibéré, que réessayer contredirait.
      if (cur.status === "TIMED-OUT" || cur.status === "FAILED") {
        throw new ScrapingIndisponibleError(
          `Run Apify ${run.id} interrompu : ${cur.status}${detail}.`,
        );
      }
      throw new Error(`Apify run ${run.id} status ${cur.status}${detail}`);
    }

    // Le run a réussi et il est facturé : une coupure au moment de lire ses
    // résultats ne doit pas conduire à en relancer un second. D'où trois
    // reprises sur place plutôt qu'une remontée vers le réessai global.
    const ds = await this.appeler(
      `${APIFY_API_BASE}/datasets/${cur.defaultDatasetId}/items?token=${token}&format=json`,
      undefined,
      3,
    );
    const items = (await ds.json()) as T[];

    // Un run vide ET porteur d'un message de quota n'est PAS une recherche
    // infructueuse : c'est une panne de configuration. La confondre avec un
    // résultat vide laisse le recruteur devant un écran « recherche en
    // cours… » qui ne se résoudra jamais.
    const message = cur.statusMessage ?? "";
    if (items.length === 0 && MOTIFS_QUOTA.test(message)) {
      throw new QuotaScrapingEpuiseError(
        `L'actor Apify a refusé de s'exécuter : « ${message} ». ` +
          `Le quota du compte de scraping est épuisé — aucun candidat ne sera trouvé ` +
          `tant qu'il n'est pas rétabli.`,
      );
    }

    this.logger.log(
      `Run Apify ${run.id} terminé : ${items.length} élément(s).` +
        (message ? ` Message : ${message}` : ""),
    );
    return { runId: run.id, items };
  }
}
