/**
 * Vérifie que les crons sont bien enregistrés et calcule leur prochaine
 * exécution. N'écrit rien en base : boot du contexte Nest puis lecture du
 * registre, sans démarrer de serveur HTTP.
 */
import "reflect-metadata";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { NestFactory } from "@nestjs/core";
import { SchedulerRegistry } from "@nestjs/schedule";
import { AppModule } from "./app.module.js";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
const registry = app.get(SchedulerRegistry);
for (const [nom, job] of registry.getCronJobs()) {
  console.log(`${nom.padEnd(22)} prochaine exécution: ${job.nextDate()?.toString() ?? "n/a"}`);
}
await app.close();
process.exit(0);
