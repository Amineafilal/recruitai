import { Injectable, BadRequestException, PayloadTooLargeException } from "@nestjs/common";
import { parse } from "csv-parse";
import { Readable } from "node:stream";
import { eq, sql } from "drizzle-orm";
import { withTenant, getAdminDb, schema } from "@recruitai/db";
import { PLAN_CONFIGS } from "@recruitai/types";
import {
  buildHeaderMap,
  rowToContact,
  dedupeKeyFor,
  mergeContacts,
  detectDelimiter,
  type ParsedContact,
} from "./csv-mapping.js";

const INSERT_CHUNK_SIZE = 500;

export interface ImportReport {
  lignesLues: number;
  importes: number;
  misAJour: number;
  ignoresSansIdentifiant: number;
  doublonsDansLeFichier: number;
  /**
   * Profils exploitables par l'enrichissement. Sans URL LinkedIn, une fiche
   * est stockée mais ne produira jamais de signal chaud — c'est l'information
   * la plus utile du rapport.
   */
  avecLinkedin: number;
}

/** Résultat de l'analyse préalable : aucune écriture en base. */
export interface ImportPreview {
  lignesLues: number;
  /** Lignes retenues après dédoublonnage intra-fichier. */
  exploitables: number;
  ignoresSansIdentifiant: number;
  doublonsDansLeFichier: number;
  avecLinkedin: number;
  avecEmail: number;
  /** En-têtes du fichier reconnus, et ceux qui seront ignorés. */
  colonnesReconnues: string[];
  colonnesIgnorees: string[];
  /** Aperçu des premières fiches, pour vérifier que le mapping est correct. */
  apercu: ParsedContact[];
  /** Renseigné si l'import dépasserait le quota du plan. */
  blocageQuota: string | null;
}

interface PendingRow {
  dedupeKey: string;
  contact: ParsedContact;
}

/** Résultat brut du parcours d'un CSV, partagé par l'aperçu et l'import. */
interface Parcours {
  lignesLues: number;
  ignoresSansIdentifiant: number;
  doublonsDansLeFichier: number;
  rows: PendingRow[];
  colonnesReconnues: string[];
  colonnesIgnorees: string[];
}

@Injectable()
export class CvthequeImportService {
  /**
   * Analyse le fichier SANS rien écrire.
   *
   * L'import écrivait directement en base : un cabinet qui déposait 8 000
   * lignes et n'en voyait arriver que 3 000 n'avait aucun moyen de comprendre
   * ce qui s'était passé, ni de revenir en arrière. L'aperçu permet de
   * vérifier le mapping des colonnes avant d'engager quoi que ce soit.
   */
  async analyserCsv(tenantId: string, stream: Readable): Promise<ImportPreview> {
    const { quota, dejaPresents } = await this.readQuota(tenantId);
    const p = await this.parcourir(stream);

    const avecLinkedin = p.rows.filter((r) => r.contact.linkedinUrl).length;
    const avecEmail = p.rows.filter((r) => r.contact.email).length;

    let blocageQuota: string | null = null;
    if (quota !== null && dejaPresents + p.rows.length > quota) {
      blocageQuota =
        `${dejaPresents} profils déjà en base + ${p.rows.length} dans ce fichier ` +
        `dépassent la limite de ${quota} de votre plan.`;
    }

    return {
      lignesLues: p.lignesLues,
      exploitables: p.rows.length,
      ignoresSansIdentifiant: p.ignoresSansIdentifiant,
      doublonsDansLeFichier: p.doublonsDansLeFichier,
      avecLinkedin,
      avecEmail,
      colonnesReconnues: p.colonnesReconnues,
      colonnesIgnorees: p.colonnesIgnorees,
      apercu: p.rows.slice(0, 5).map((r) => r.contact),
      blocageQuota,
    };
  }

  async importCsv(tenantId: string, stream: Readable): Promise<ImportReport> {
    const { quota, dejaPresents } = await this.readQuota(tenantId);
    const p = await this.parcourir(stream);

    if (quota !== null) {
      // Estimation haute : on ne connaît pas encore la part de mises à jour vs
      // créations, donc on refuse si le pire cas dépasse le quota du plan.
      const pireCas = dejaPresents + p.rows.length;
      if (pireCas > quota) {
        throw new PayloadTooLargeException(
          `Import refusé : ${dejaPresents} profils déjà présents + ${p.rows.length} dans le fichier dépasse la limite de ${quota} de votre plan.`,
        );
      }
    }

    const report: ImportReport = {
      lignesLues: p.lignesLues,
      importes: 0,
      misAJour: 0,
      ignoresSansIdentifiant: p.ignoresSansIdentifiant,
      doublonsDansLeFichier: p.doublonsDansLeFichier,
      avecLinkedin: p.rows.filter((r) => r.contact.linkedinUrl).length,
    };

    for (let i = 0; i < p.rows.length; i += INSERT_CHUNK_SIZE) {
      const chunk = p.rows.slice(i, i + INSERT_CHUNK_SIZE);
      const inserted = await this.upsertChunk(tenantId, chunk);
      report.importes += inserted;
      report.misAJour += chunk.length - inserted;
    }

    return report;
  }

  /**
   * Parcourt le CSV et retourne les lignes exploitables. Utilisé à l'identique
   * par l'aperçu et par l'import : les deux DOIVENT compter de la même façon,
   * sinon l'aperçu annoncerait des chiffres que l'import ne tiendrait pas.
   */
  private async parcourir(stream: Readable): Promise<Parcours> {
    const { delimiter, stream: csvStream } = await this.sniffDelimiter(stream);

    const parser = csvStream.pipe(
      parse({
        columns: false,
        skip_empty_lines: true,
        trim: true,
        bom: true,
        relax_column_count: true,
        delimiter,
      }),
    );

    let headerMap: Map<number, string> | undefined;
    let colonnesReconnues: string[] = [];
    let colonnesIgnorees: string[] = [];
    let lignesLues = 0;
    let ignoresSansIdentifiant = 0;
    let doublonsDansLeFichier = 0;

    // Dédoublonnage intra-fichier : le même contact peut apparaître plusieurs
    // fois dans un export ATS. On garde la dernière occurrence.
    const seen = new Map<string, ParsedContact>();

    for await (const row of parser as AsyncIterable<string[]>) {
      if (!headerMap) {
        headerMap = buildHeaderMap(row);
        if (headerMap.size === 0) {
          throw new BadRequestException(
            "Aucune colonne reconnue dans l'en-tête du CSV (attendu au moins email ou LinkedIn).",
          );
        }
        // On garde les intitulés d'origine pour pouvoir dire au cabinet
        // lesquels de SES en-têtes ont été compris et lesquels sont ignorés.
        row.forEach((brut, i) => {
          if (!brut?.trim()) return;
          (headerMap!.has(i) ? colonnesReconnues : colonnesIgnorees).push(brut.trim());
        });
        continue;
      }

      lignesLues += 1;
      const contact = rowToContact(row, headerMap);
      const key = dedupeKeyFor(contact);
      if (!key) {
        ignoresSansIdentifiant += 1;
        continue;
      }
      const previous = seen.get(key);
      if (previous) {
        doublonsDansLeFichier += 1;
        seen.set(key, mergeContacts(previous, contact));
      } else {
        seen.set(key, contact);
      }
    }

    if (!headerMap) {
      throw new BadRequestException("Fichier CSV vide.");
    }

    return {
      lignesLues,
      ignoresSansIdentifiant,
      doublonsDansLeFichier,
      rows: [...seen.entries()].map(([dedupeKey, contact]) => ({ dedupeKey, contact })),
      colonnesReconnues,
      colonnesIgnorees,
    };
  }

  /**
   * Lit juste assez d'octets pour voir la ligne d'en-tête et en déduire le
   * séparateur, puis reconstruit un flux équivalent (octets consommés +
   * reste) pour que le parsing démarre bien au début du fichier.
   */
  private async sniffDelimiter(stream: Readable): Promise<{ delimiter: string; stream: Readable }> {
    // On pilote l'itérateur à la main : sortir d'un `for await` par `break`
    // appelle iterator.return(), ce qui détruit le flux source — on perdrait
    // tout le fichier après la première ligne.
    const iterator = stream[Symbol.asyncIterator]();
    const chunks: Buffer[] = [];
    let headerLine: string | undefined;

    while (headerLine === undefined) {
      const { value, done } = await iterator.next();
      if (done) break;

      chunks.push(Buffer.isBuffer(value) ? value : Buffer.from(value as string));
      const soFar = Buffer.concat(chunks).toString("utf-8");
      const newlineIndex = soFar.indexOf("\n");
      if (newlineIndex !== -1) {
        headerLine = soFar.slice(0, newlineIndex);
      } else if (soFar.length > 1024 * 1024) {
        // Garde-fou : un fichier sans aucun saut de ligne n'est pas un CSV
        // exploitable, on n'accumule pas indéfiniment en mémoire.
        headerLine = soFar;
      }
    }

    if (headerLine === undefined && chunks.length === 0) {
      throw new BadRequestException("Fichier CSV vide.");
    }

    const buffered = Buffer.concat(chunks);
    const replayed = Readable.from(
      (async function* () {
        yield buffered;
        // Reprend l'itérateur là où le sniffing s'est arrêté.
        while (true) {
          const { value, done } = await iterator.next();
          if (done) return;
          yield value;
        }
      })(),
    );

    return { delimiter: detectDelimiter(headerLine ?? ""), stream: replayed };
  }

  /**
   * Insère un lot en une requête, en écrasant le contact des fiches déjà
   * connues (même dedupe_key pour ce tenant). Renvoie le nombre de créations
   * réelles — `xmax = 0` distingue une ligne insérée d'une ligne mise à jour.
   */
  private async upsertChunk(tenantId: string, chunk: PendingRow[]): Promise<number> {
    return withTenant(tenantId, async (tx) => {
      const result = await tx
        .insert(schema.cvthequeProfiles)
        .values(chunk.map(({ dedupeKey, contact }) => ({ tenantId, dedupeKey, contact })))
        .onConflictDoUpdate({
          target: [schema.cvthequeProfiles.tenantId, schema.cvthequeProfiles.dedupeKey],
          set: { contact: sql`excluded.contact` },
        })
        .returning({ isNew: sql<boolean>`(xmax = 0)` });

      return result.filter((r) => r.isNew).length;
    });
  }

  /** Quota de profils du plan (null = illimité) + volume déjà stocké. */
  private async readQuota(tenantId: string): Promise<{ quota: number | null; dejaPresents: number }> {
    const [tenant] = await getAdminDb().select().from(schema.tenants).where(eq(schema.tenants.id, tenantId));
    if (!tenant) throw new BadRequestException("Agence introuvable");

    const dejaPresents = await withTenant(tenantId, async (tx) => {
      const [row] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.cvthequeProfiles)
        .where(eq(schema.cvthequeProfiles.tenantId, tenantId));
      return row?.count ?? 0;
    });

    return { quota: PLAN_CONFIGS[tenant.plan].maxCvthequeProfiles, dejaPresents };
  }
}
