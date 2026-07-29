import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const connectionString = process.env.DIRECT_URL;
if (!connectionString) {
  throw new Error("DIRECT_URL is not set");
}

/** État réel de la base : tables, RLS, policies, rôles. */
async function main() {
  const sql = postgres(connectionString!, { max: 1 });

  const tables = await sql`
    select c.relname as table,
           c.relrowsecurity as rls_active,
           c.relforcerowsecurity as rls_forcee,
           (select count(*) from pg_policies p
             where p.schemaname = 'public' and p.tablename = c.relname) as policies
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname
  `;

  console.log(`\nTables (${tables.length}) :`);
  console.table(
    tables.map((t) => ({
      table: t.table,
      RLS: t.rls_active ? "on" : "OFF",
      FORCE: t.rls_forcee ? "on" : "off",
      policies: Number(t.policies),
    })),
  );

  const roles = await sql`
    select rolname, rolbypassrls, rolcanlogin
    from pg_roles
    where rolname in ('postgres', 'recruitai_app', 'recruitai_admin')
    order by rolname
  `;
  console.log("\nRôles applicatifs :");
  console.table(roles.map((r) => ({ role: r.rolname, bypassrls: r.rolbypassrls, login: r.rolcanlogin })));

  const manquants = ["recruitai_app", "recruitai_admin"].filter(
    (nom) => !roles.some((r) => r.rolname === nom),
  );
  if (manquants.length > 0) {
    console.log(`\nRôles non créés : ${manquants.join(", ")} — exécuter sql/0002_supabase_roles.sql.`);
  }

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
