import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "./schema.js";

export type Db = PostgresJsDatabase<typeof schema>;

let appDb: Db | undefined;
let adminDb: Db | undefined;

/**
 * Le pooler Supabase (port 6543) fonctionne en mode transaction : une même
 * connexion physique est réutilisée par plusieurs clients entre deux
 * transactions. Les prepared statements de postgres-js, eux, sont attachés à
 * la session — ils provoquent des « prepared statement already exists » dès
 * qu'on passe par le pooler. D'où prepare: false.
 */
function connect(connectionString: string, opts: { pooled: boolean }): Db {
  return drizzle(postgres(connectionString, { prepare: !opts.pooled }), { schema });
}

/**
 * Connexion applicative : rôle recruitai_app, SANS BYPASSRLS. Toute lecture
 * ou écriture de données d'agence passe par ici, via withTenant(), et est
 * donc réellement filtrée par les policies RLS — y compris en cas d'oubli de
 * clause WHERE dans une requête.
 */
function getAppDb(): Db {
  if (!appDb) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    appDb = connect(connectionString, { pooled: true });
  }
  return appDb;
}

/**
 * Connexion d'administration : rôle recruitai_admin, AVEC BYPASSRLS. Réservée
 * aux trois cas qui ne peuvent structurellement pas être filtrés par tenant :
 *  1. migrations et scripts ;
 *  2. résolution « organisation Clerk → tenant » à l'authentification, avant
 *     qu'un contexte tenant n'existe ;
 *  3. scheduler du worker, qui énumère les postes/campagnes de tous les
 *     tenants pour alimenter les files.
 * Ne jamais l'utiliser pour servir des données d'agence à une requête.
 */
export function getAdminDb(): Db {
  if (!adminDb) {
    const connectionString = process.env.ADMIN_DATABASE_URL ?? process.env.DIRECT_URL;
    if (!connectionString) {
      throw new Error("ADMIN_DATABASE_URL (ou DIRECT_URL) is not set");
    }
    adminDb = connect(connectionString, { pooled: false });
  }
  return adminDb;
}

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Exécute `fn` dans une transaction cadrée sur `tenantId` : la variable de
 * session app.tenant_id est posée via set_config, ce qui active les policies
 * de sql/0001_rls.sql. Seule façon correcte de toucher aux tables métier.
 *
 * set_config(..., true) est transaction-scoped, donc compatible avec le
 * pooler Supabase en mode transaction.
 */
export async function withTenant<T>(tenantId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return getAppDb().transaction(async (tx) => {
    // Le tag sql`` passe tenantId en paramètre lié : aucune injection possible.
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    return fn(tx);
  });
}

export * as schema from "./schema.js";
