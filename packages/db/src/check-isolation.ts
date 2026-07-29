import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

/**
 * Vérifie que l'isolation multi-tenant est réellement appliquée par Postgres,
 * et pas seulement par la discipline du code applicatif.
 *
 * Crée deux agences fictives avec un poste chacune, puis tente de lire les
 * données de l'agence B depuis le contexte de l'agence A. Nettoie derrière
 * lui dans tous les cas.
 *
 * À lancer après migrate + rls + création des rôles :
 *   npm run --workspace=@recruitai/db check-isolation
 */
async function main() {
  const appUrl = process.env.DATABASE_URL;
  const adminUrl = process.env.ADMIN_DATABASE_URL ?? process.env.DIRECT_URL;
  if (!appUrl || !adminUrl) {
    throw new Error("DATABASE_URL et ADMIN_DATABASE_URL (ou DIRECT_URL) doivent être définis");
  }

  const admin = postgres(adminUrl, { max: 1 });
  const app = postgres(appUrl, { max: 1, prepare: false });

  let tenantA: string | undefined;
  let tenantB: string | undefined;
  let echecs = 0;

  try {
    const [rolCheck] = await admin`
      select rolbypassrls from pg_roles where rolname = current_user
    `;
    console.log(`Rôle admin — bypassrls: ${rolCheck?.rolbypassrls}`);

    const [appRole] = await app`select current_user, (select rolbypassrls from pg_roles where rolname = current_user) as bypass`;
    console.log(`Rôle applicatif — ${appRole.current_user}, bypassrls: ${appRole.bypass}`);
    if (appRole.bypass === true) {
      console.error("ÉCHEC : le rôle applicatif contourne RLS — l'isolation n'est pas garantie.");
      echecs++;
    }

    const [a] = await admin`
      insert into tenants (nom, plan, clerk_org_id)
      values ('Agence A (test)', 'starter', ${"test_org_a_" + Date.now()})
      returning id
    `;
    const [b] = await admin`
      insert into tenants (nom, plan, clerk_org_id)
      values ('Agence B (test)', 'starter', ${"test_org_b_" + Date.now()})
      returning id
    `;
    tenantA = a.id;
    tenantB = b.id;

    const criteresA = JSON.stringify({ titre: "Poste A", competences: [] });
    const criteresB = JSON.stringify({ titre: "Poste B", competences: [] });
    await admin`insert into jobs (tenant_id, criteres) values (${tenantA!}, ${criteresA}::jsonb)`;
    await admin`insert into jobs (tenant_id, criteres) values (${tenantB!}, ${criteresB}::jsonb)`;

    // Lecture dans le contexte de l'agence A : doit voir 1 poste, pas 2.
    const vusParA = await app.begin(async (tx) => {
      await tx`select set_config('app.tenant_id', ${tenantA!}, true)`;
      return tx`select id, tenant_id from jobs`;
    });

    console.log(`Postes visibles depuis l'agence A : ${vusParA.length} (attendu : 1)`);
    if (vusParA.length !== 1) {
      console.error("ÉCHEC : fuite entre tenants sur la table jobs.");
      echecs++;
    } else if (vusParA[0].tenant_id !== tenantA) {
      console.error("ÉCHEC : l'agence A voit un poste appartenant à une autre agence.");
      echecs++;
    }

    // Sans contexte tenant : ne doit rien voir du tout.
    const sansContexte = await app`select id from jobs`;
    console.log(`Postes visibles sans contexte tenant : ${sansContexte.length} (attendu : 0)`);
    if (sansContexte.length !== 0) {
      console.error("ÉCHEC : des données sont lisibles sans contexte tenant.");
      echecs++;
    }

    // Écriture croisée : l'agence A ne doit pas pouvoir modifier l'agence B.
    const misAJour = await app.begin(async (tx) => {
      await tx`select set_config('app.tenant_id', ${tenantA!}, true)`;
      return tx`update jobs set statut = 'clos' where tenant_id = ${tenantB!} returning id`;
    });
    console.log(`Postes de B modifiés depuis A : ${misAJour.length} (attendu : 0)`);
    if (misAJour.length !== 0) {
      console.error("ÉCHEC : écriture cross-tenant possible.");
      echecs++;
    }
  } finally {
    if (tenantA) await admin`delete from tenants where id = ${tenantA}`;
    if (tenantB) await admin`delete from tenants where id = ${tenantB}`;
    await admin.end();
    await app.end();
  }

  if (echecs > 0) {
    console.error(`\n${echecs} vérification(s) en échec — l'isolation multi-tenant n'est PAS garantie.`);
    process.exit(1);
  }
  console.log("\nIsolation multi-tenant vérifiée.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
