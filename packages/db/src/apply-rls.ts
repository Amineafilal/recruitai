import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

// Mode session (port 5432) : ALTER TABLE / CREATE POLICY sont du DDL.
const connectionString = process.env.DIRECT_URL;
if (!connectionString) {
  throw new Error("DIRECT_URL is not set (pooler Supabase en mode session, port 5432)");
}

async function main() {
  const statements = readFileSync(fileURLToPath(new URL("../sql/0001_rls.sql", import.meta.url)), "utf-8");
  const client = postgres(connectionString!, { max: 1 });
  await client.unsafe(statements);
  await client.end();
  console.log("RLS policies applied.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
