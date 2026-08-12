import { config } from "dotenv";
import { fileURLToPath } from "node:url";

// Next.js n'auto-charge que apps/web/.env*, pas le .env partagé à la racine
// du monorepo — on le charge nous-mêmes ici, tôt, avant que Next ne démarre.
config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Les paquets du monorepo sont publiés en TypeScript brut, sans étape de
  // build : Next doit donc les compiler lui-même.
  transpilePackages: ["@recruitai/types"],

  webpack: (config) => {
    // Leurs imports internes portent l'extension « .js » exigée par ESM, alors
    // que les fichiers sont des « .ts ». Sans cette équivalence, webpack échoue
    // sur « Can't resolve './plan.js' » dès qu'un composant importe le paquet.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
