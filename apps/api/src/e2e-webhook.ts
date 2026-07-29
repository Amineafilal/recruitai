import { fileURLToPath } from "node:url";
import { config } from "dotenv";
config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

import { Webhook } from "svix";
import { eq } from "drizzle-orm";
import { getAdminDb, schema } from "@recruitai/db";

// Prérequis : l'API doit tourner avec le MÊME CLERK_WEBHOOK_SECRET que ce
// process. En local :
//   CLERK_WEBHOOK_SECRET=whsec_test... npm run start          (terminal 1)
//   CLERK_WEBHOOK_SECRET=whsec_test... npm run test:webhook   (terminal 2)
const SECRET = process.env.CLERK_WEBHOOK_SECRET;
if (!SECRET) {
  throw new Error("CLERK_WEBHOOK_SECRET is not set (doit correspondre à celui de l'API lancée)");
}
const API = process.env.API_BASE_URL ?? "http://localhost:3001";

function signAndBuild(payload: object) {
  const body = JSON.stringify(payload);
  const wh = new Webhook(SECRET!);
  const msgId = `msg_${Date.now()}`;
  const timestamp = new Date();
  const signature = wh.sign(msgId, timestamp, body);
  return {
    body,
    headers: {
      "Content-Type": "application/json",
      "svix-id": msgId,
      "svix-timestamp": Math.floor(timestamp.getTime() / 1000).toString(),
      "svix-signature": signature,
    },
  };
}

async function post(payload: object) {
  const { body, headers } = signAndBuild(payload);
  const res = await fetch(`${API}/webhooks/clerk`, { method: "POST", headers, body });
  return res.status;
}

const orgId = `org_e2e_${Date.now()}`;
const userId = `user_e2e_${Date.now()}`;
const db = getAdminDb();
let echecs = 0;
function verifie(label: string, ok: boolean) {
  console.log(`${ok ? "  OK  " : " ECHEC"} ${label}`);
  if (!ok) echecs++;
}

async function main() {
  try {
    console.log("1) organization.created -> tenant");
    const s1 = await post({ type: "organization.created", data: { id: orgId, name: "Agence Webhook" } });
    verifie(`réponse 200 (obtenu ${s1})`, s1 === 200);
    const [tenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.clerkOrgId, orgId));
    verifie("tenant créé en base", !!tenant);
    verifie("nom correct", tenant?.nom === "Agence Webhook");

    console.log("\n2) organizationMembership.created -> user");
    const s2 = await post({
      type: "organizationMembership.created",
      data: {
        organization: { id: orgId },
        public_user_data: { user_id: userId, identifier: "admin@agence.fr" },
        role: "org:admin",
      },
    });
    verifie(`réponse 200 (obtenu ${s2})`, s2 === 200);
    const [user] = await db.select().from(schema.users).where(eq(schema.users.clerkUserId, userId));
    verifie("user créé en base", !!user);
    verifie("rattaché au bon tenant", user?.tenantId === tenant?.id);
    verifie("rôle admin déduit de org:admin", user?.role === "admin");

    console.log("\n3) organization.updated -> renommage idempotent");
    await post({ type: "organization.created", data: { id: orgId, name: "Agence Renommée" } });
    const tenantsApres = await db.select().from(schema.tenants).where(eq(schema.tenants.clerkOrgId, orgId));
    verifie("toujours un seul tenant (pas de doublon)", tenantsApres.length === 1);
    verifie("nom mis à jour", tenantsApres[0]?.nom === "Agence Renommée");

    console.log("\n4) organization.deleted -> cascade");
    const s4 = await post({ type: "organization.deleted", data: { id: orgId } });
    verifie(`réponse 200 (obtenu ${s4})`, s4 === 200);
    const restants = await db.select().from(schema.tenants).where(eq(schema.tenants.clerkOrgId, orgId));
    verifie("tenant supprimé", restants.length === 0);
    const usersRestants = await db.select().from(schema.users).where(eq(schema.users.clerkUserId, userId));
    verifie("user supprimé en cascade", usersRestants.length === 0);
  } finally {
    await db.delete(schema.tenants).where(eq(schema.tenants.clerkOrgId, orgId));
  }

  if (echecs > 0) {
    console.error(`\n${echecs} échec(s).`);
    process.exit(1);
  }
  console.log("\nWebhook Clerk : toutes les vérifications passent.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
