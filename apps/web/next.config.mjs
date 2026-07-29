import { config } from "dotenv";
import { fileURLToPath } from "node:url";

// Next.js n'auto-charge que apps/web/.env*, pas le .env partagé à la racine
// du monorepo — on le charge nous-mêmes ici, tôt, avant que Next ne démarre.
config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
