import type { ScrapeSource } from "@recruitai/types";

/** Mappe chaque source vers l'ID de l'actor Apify configuré en env. */
export function actorIdFor(source: ScrapeSource): string {
  const key = `APIFY_${source.toUpperCase()}_ACTOR_ID`;
  const actorId = process.env[key];
  if (!actorId) {
    throw new Error(`${key} is not set`);
  }
  return actorId;
}
