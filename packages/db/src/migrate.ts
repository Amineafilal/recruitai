import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

// fileURLToPath et non URL.pathname : sous Windows, pathname renvoie
// "/C:/Users/..." avec un slash initial que fs ne sait pas résoudre.
config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

// Connexion Supabase en mode session (port 5432) : le mode transaction ne
// supporte ni le DDL ni les advisory locks utilisés par le migrator.
const connectionString = process.env.DIRECT_URL;
if (!connectionString) {
  throw new Error("DIRECT_URL is not set (pooler Supabase en mode session, port 5432)");
}

async function main() {
  const migrationClient = postgres(connectionString!, { max: 1 });
  const db = drizzle(migrationClient);
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
  });
  await migrationClient.end();
  console.log("Migrations applied.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
