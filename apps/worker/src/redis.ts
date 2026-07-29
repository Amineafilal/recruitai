import { Redis } from "ioredis";

const url = process.env.REDIS_URL;
if (!url) {
  throw new Error("REDIS_URL is not set");
}

export const connection = new Redis(url, { maxRetriesPerRequest: null });
