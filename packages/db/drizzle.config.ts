import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: "../../.env" });

// DIRECT_URL (port 5432) et non DATABASE_URL (pooler 6543) : drizzle-kit a
// besoin de DDL et d'advisory locks, que le pooler en mode transaction ne
// supporte pas.
const url = process.env.DIRECT_URL;
if (!url) {
  throw new Error("DIRECT_URL is not set (connexion directe Supabase, port 5432)");
}

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
});
