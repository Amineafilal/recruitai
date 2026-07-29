// DOIT rester le tout premier import : charge la configuration avant que les
// modules ne lisent process.env à leur évaluation (ordre ESM).
import { verifierEnvironnement, originesAutorisees } from "./env.js";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  verifierEnvironnement();

  // rawBody: expose le corps brut de la requête (req.rawBody). Indispensable
  // pour vérifier la signature Svix des webhooks Clerk, qui porte sur les
  // octets exacts reçus, pas sur le JSON reparsé.
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    rawBody: true,
  });

  await app.register(cors, { origin: originesAutorisees(), credentials: true });
  // Import CVthèque : un export ATS de 50k lignes pèse typiquement < 50 Mo.
  await app.register(multipart, { limits: { fileSize: 100 * 1024 * 1024, files: 1 } });

  // PORT est injecté par l'hébergeur (Railway, Render…) et doit primer sur
  // toute valeur locale : un port figé empêcherait la plateforme de router le
  // trafic vers le conteneur.
  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3001);
  await app.listen(port, "0.0.0.0");
  console.log(`RecruitAI API listening on :${port} (${process.env.NODE_ENV ?? "development"})`);
}

bootstrap().catch((err) => {
  console.error("Démarrage impossible :", err instanceof Error ? err.message : err);
  process.exit(1);
});
