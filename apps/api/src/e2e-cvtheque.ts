import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { config } from "dotenv";
config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

import { eq, and } from "drizzle-orm";
import {
  getAdminDb,
  withTenant,
  schema,
  selectionnerCiblesRelance,
  selectionnerProfilsObsoletes,
} from "@recruitai/db";
import { CvthequeImportService } from "./cvtheque/cvtheque-import.service.js";
import { OptOutService } from "./rgpd/optout.service.js";

const admin = getAdminDb();
let echecs = 0;

function verifie(label: string, obtenu: unknown, attendu: unknown) {
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  console.log(`${ok ? "  OK  " : " ECHEC"} ${label} — obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`);
  if (!ok) echecs++;
}

const CSV = `Prénom;Nom;E-mail;Téléphone;Profil LinkedIn;Intitulé;Ville
Marie;Dupont;Marie.DUPONT@example.com;0612345678;https://www.linkedin.com/in/mariedupont/;Développeuse;Lyon
Jean;Martin;;0698765432;http://linkedin.com/in/jeanmartin?trk=abc;Data Analyst;Paris
Marie;Dupont;marie.dupont@example.com;;;Dev Senior;Lyon
Sans;Identifiant;;;;;Nantes
Sophie;Bernard;sophie.bernard@example.com;0611223344;;Product Manager;Bordeaux
`;

async function main() {
  const [tenant] = await admin
    .insert(schema.tenants)
    .values({ nom: "Agence E2E", plan: "growth", clerkOrgId: `e2e_${Date.now()}` })
    .returning();
  const tenantId = tenant.id;
  console.log(`Tenant de test : ${tenantId}\n`);

  try {
    const importService = new CvthequeImportService();

    console.log("1) Premier import");
    const r1 = await importService.importCsv(tenantId, Readable.from([CSV]));
    console.log("   ", r1);
    verifie("lignes lues", r1.lignesLues, 5);
    verifie("sans identifiant ignoré", r1.ignoresSansIdentifiant, 1);
    verifie("doublon intra-fichier", r1.doublonsDansLeFichier, 1);
    verifie("profils créés", r1.importes, 3);
    verifie("profils mis à jour", r1.misAJour, 0);

    const apres1 = await withTenant(tenantId, (tx) =>
      tx.select().from(schema.cvthequeProfiles).where(eq(schema.cvthequeProfiles.tenantId, tenantId)),
    );
    verifie("profils en base", apres1.length, 3);

    const marie = apres1.find((p) => (p.contact as any).email === "marie.dupont@example.com");
    verifie("fusion : téléphone conservé", (marie!.contact as any).telephone, "0612345678");
    verifie("fusion : poste le plus récent", (marie!.contact as any).poste, "Dev Senior");
    verifie("token opt-out généré", typeof marie!.optOutToken === "string" && marie!.optOutToken.length > 0, true);

    console.log("\n2) Ré-import du même fichier (idempotence)");
    const r2 = await importService.importCsv(tenantId, Readable.from([CSV]));
    console.log("   ", r2);
    verifie("aucune création", r2.importes, 0);
    verifie("tout en mise à jour", r2.misAJour, 3);

    const apres2 = await withTenant(tenantId, (tx) =>
      tx.select().from(schema.cvthequeProfiles).where(eq(schema.cvthequeProfiles.tenantId, tenantId)),
    );
    verifie("toujours 3 profils (pas de doublon)", apres2.length, 3);

    console.log("\n3) Opt-out via le jeton public");
    const optOutService = new OptOutService();
    const res1 = await optOutService.optOutByToken(marie!.optOutToken);
    verifie("premier opt-out enregistré", res1.dejaDesinscrit, false);
    const res2 = await optOutService.optOutByToken(marie!.optOutToken);
    verifie("second appel idempotent", res2.dejaDesinscrit, true);

    const consentements = await withTenant(tenantId, (tx) =>
      tx.select().from(schema.consents).where(eq(schema.consents.tenantId, tenantId)),
    );
    verifie("un seul consentement", consentements.length, 1);
    verifie("opt-out lié à la dedupeKey", consentements[0].dedupeKey, marie!.dedupeKey);

    console.log("\n4) L'opt-out survit à un ré-import (fiche recréée)");
    await withTenant(tenantId, (tx) =>
      tx.delete(schema.cvthequeProfiles).where(eq(schema.cvthequeProfiles.id, marie!.id)),
    );
    await importService.importCsv(tenantId, Readable.from([CSV]));
    const recree = await withTenant(tenantId, async (tx) => {
      const [row] = await tx
        .select()
        .from(schema.cvthequeProfiles)
        .where(and(eq(schema.cvthequeProfiles.tenantId, tenantId), eq(schema.cvthequeProfiles.dedupeKey, marie!.dedupeKey)));
      return row;
    });
    verifie("fiche bien recréée avec un nouvel id", recree.id !== marie!.id, true);
    const optOutsApres = await withTenant(tenantId, (tx) =>
      tx
        .select()
        .from(schema.consents)
        .where(and(eq(schema.consents.tenantId, tenantId), eq(schema.consents.type, "opt_out"))),
    );
    const cleOptOut = new Set(optOutsApres.map((c) => c.dedupeKey));
    verifie("opt-out toujours actif sur la nouvelle fiche", cleOptOut.has(recree.dedupeKey), true);

    console.log("\n5) Ciblage des relances (requête du worker outreach)");
    const [campagne] = await withTenant(tenantId, (tx) =>
      tx
        .insert(schema.campaigns)
        .values({
          tenantId,
          nom: "Réactivation",
          sujet: "Bonjour {{prenom}}",
          template: "<p>Bonjour {{prenom}}, une opportunité de {{poste}} ?</p>",
          declencheur: "changement_poste",
        })
        .returning(),
    );

    // Tous les profils passent en "chaud" pour être éligibles.
    await withTenant(tenantId, (tx) =>
      tx
        .update(schema.cvthequeProfiles)
        .set({ statutChaud: true })
        .where(eq(schema.cvthequeProfiles.tenantId, tenantId)),
    );

    const cibles = await selectionnerCiblesRelance(tenantId, campagne.delaiMinRelanceJours);
    verifie("Marie exclue car désinscrite", cibles.some((c) => c.dedupeKey === recree.dedupeKey), false);
    // 3 profils : Marie désinscrite, Jean sans email -> seule Sophie reste.
    verifie("1 seul candidat éligible", cibles.length, 1);
    verifie(
      "Jean exclu faute d'email",
      cibles.some((c) => (c.contact as any).linkedinUrl && !(c.contact as any).email),
      false,
    );

    console.log("\n6) Anti-relance : un envoi récent exclut le profil");
    const sophie = cibles.find((c) => (c.contact as any).email === "sophie.bernard@example.com")!;
    await withTenant(tenantId, (tx) =>
      tx.insert(schema.outreachMessages).values({
        tenantId,
        profileId: sophie.id,
        campaignId: campagne.id,
        destinataire: "sophie.bernard@example.com",
        sujet: "Bonjour Sophie",
        statut: "envoye",
      }),
    );
    const ciblesApres = await selectionnerCiblesRelance(tenantId, campagne.delaiMinRelanceJours);
    verifie("Sophie exclue après envoi récent", ciblesApres.some((c) => c.id === sophie.id), false);
    verifie("plus aucun candidat éligible", ciblesApres.length, 0);

    console.log("\n7) Purge RGPD (jointure sur le dernier contact)");
    // Profil ancien jamais contacté -> doit être purgé.
    // Sophie a un message récent -> doit être conservée.
    const vieilleDate = new Date();
    vieilleDate.setMonth(vieilleDate.getMonth() - 30);
    await withTenant(tenantId, (tx) =>
      tx
        .update(schema.cvthequeProfiles)
        .set({ createdAt: vieilleDate })
        .where(eq(schema.cvthequeProfiles.tenantId, tenantId)),
    );

    const aPurger = await selectionnerProfilsObsoletes(tenantId, 24);
    verifie("Sophie conservée (contact récent)", aPurger.some((p) => p.id === sophie.id), false);
    verifie("2 profils obsolètes détectés", aPurger.length, 2);
  } finally {
    await admin.delete(schema.tenants).where(eq(schema.tenants.id, tenantId));
    console.log("\nTenant de test supprimé.");
  }

  if (echecs > 0) {
    console.error(`\n${echecs} vérification(s) en échec.`);
    process.exit(1);
  }
  console.log("\nToutes les vérifications passent.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
