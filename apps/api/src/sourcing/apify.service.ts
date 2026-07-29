import { Injectable, Logger } from "@nestjs/common";

const APIFY_API_BASE = "https://api.apify.com/v2";
const TERMINAL = new Set(["SUCCEEDED", "FAILED", "TIMED-OUT", "ABORTED"]);

interface ApifyRun {
  id: string;
  status: string;
  defaultDatasetId: string;
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

  async runActor<T = unknown>(
    actorId: string,
    input: unknown,
    timeoutMs = 10 * 60 * 1000,
  ): Promise<{ runId: string; items: T[] }> {
    const token = this.token();
    if (!token) throw new Error("APIFY_TOKEN is not set");

    const start = await fetch(`${APIFY_API_BASE}/acts/${actorId}/runs?token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!start.ok) throw new Error(`Apify start ${start.status}: ${await start.text()}`);
    const run = ((await start.json()) as { data: ApifyRun }).data;

    const deadline = Date.now() + timeoutMs;
    let cur = run;
    while (!TERMINAL.has(cur.status)) {
      if (Date.now() > deadline) throw new Error(`Apify run ${run.id} timeout`);
      await new Promise((r) => setTimeout(r, 5000));
      const res = await fetch(`${APIFY_API_BASE}/actor-runs/${run.id}?token=${token}`);
      cur = ((await res.json()) as { data: ApifyRun }).data;
    }
    if (cur.status !== "SUCCEEDED") throw new Error(`Apify run ${run.id} status ${cur.status}`);

    const ds = await fetch(
      `${APIFY_API_BASE}/datasets/${cur.defaultDatasetId}/items?token=${token}&format=json`,
    );
    const items = (await ds.json()) as T[];
    this.logger.log(`Run Apify ${run.id} terminé : ${items.length} élément(s).`);
    return { runId: run.id, items };
  }
}
