const APIFY_API_BASE = "https://api.apify.com/v2";

interface ApifyRun {
  id: string;
  status: "READY" | "RUNNING" | "SUCCEEDED" | "FAILED" | "TIMED-OUT" | "ABORTED";
  defaultDatasetId: string;
}

const TERMINAL_STATUSES = new Set(["SUCCEEDED", "FAILED", "TIMED-OUT", "ABORTED"]);

function requireToken(): string {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    throw new Error("APIFY_TOKEN is not set");
  }
  return token;
}

async function startRun(actorId: string, input: unknown): Promise<ApifyRun> {
  const token = requireToken();
  const response = await fetch(`${APIFY_API_BASE}/acts/${actorId}/runs?token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Apify run start failed for actor ${actorId}: ${response.status} ${await response.text()}`);
  }
  const body = (await response.json()) as { data: ApifyRun };
  return body.data;
}

async function getRun(runId: string): Promise<ApifyRun> {
  const token = requireToken();
  const response = await fetch(`${APIFY_API_BASE}/actor-runs/${runId}?token=${token}`);
  if (!response.ok) {
    throw new Error(`Apify get run failed for ${runId}: ${response.status} ${await response.text()}`);
  }
  const body = (await response.json()) as { data: ApifyRun };
  return body.data;
}

async function getDatasetItems<T = unknown>(datasetId: string): Promise<T[]> {
  const token = requireToken();
  const response = await fetch(`${APIFY_API_BASE}/datasets/${datasetId}/items?token=${token}&format=json`);
  if (!response.ok) {
    throw new Error(`Apify dataset fetch failed for ${datasetId}: ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as T[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface RunActorResult<T = unknown> {
  runId: string;
  items: T[];
}

/**
 * Lance un actor Apify, attend sa fin par polling (backoff simple), puis
 * récupère les résultats du dataset. Préférer cette approche au endpoint
 * "run-sync-get-dataset-items" d'Apify, qui timeout sur les gros batches
 * (ex: enrichissement CVthèque avec plusieurs centaines de profils).
 */
export async function runActorAndCollect<T = unknown>(
  actorId: string,
  input: unknown,
  opts: { maxWaitMs?: number; pollIntervalMs?: number } = {},
): Promise<RunActorResult<T>> {
  const maxWaitMs = opts.maxWaitMs ?? 10 * 60 * 1000;
  const pollIntervalMs = opts.pollIntervalMs ?? 5000;

  const run = await startRun(actorId, input);
  const deadline = Date.now() + maxWaitMs;

  let current = run;
  while (!TERMINAL_STATUSES.has(current.status)) {
    if (Date.now() > deadline) {
      throw new Error(`Apify run ${run.id} on actor ${actorId} did not finish within ${maxWaitMs}ms`);
    }
    await sleep(pollIntervalMs);
    current = await getRun(run.id);
  }

  if (current.status !== "SUCCEEDED") {
    throw new Error(`Apify run ${run.id} on actor ${actorId} ended with status ${current.status}`);
  }

  const items = await getDatasetItems<T>(current.defaultDatasetId);
  return { runId: run.id, items };
}
