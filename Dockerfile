# Image de l'API RecruitAI.
#
# Le site (apps/web) n'est PAS dans cette image : il est déployé séparément sur
# Vercel. Seuls l'API et les paquets partagés sont embarqués.
#
# Le code TypeScript n'est pas précompilé : il est transpilé au démarrage par
# @swc-node/register, comme en développement. Les paquets du monorepo
# (@recruitai/db, types, ai) exposent directement leurs sources et n'ont pas
# d'étape de build — les précompiler imposerait de revoir leurs exports.
FROM node:20-slim

WORKDIR /app
ENV NODE_ENV=production

# Manifestes d'abord : cette couche n'est reconstruite que si une dépendance
# change, pas à chaque modification de code. Tous les package.json des
# workspaces sont nécessaires, sinon `npm ci` refuse de valider le lockfile.
# tsconfig.base.json est indispensable au runtime, pas seulement au build :
# @swc-node/register le lit au démarrage pour transpiler, et tous les
# tsconfig.json du monorepo l'étendent.
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/worker/package.json ./apps/worker/
COPY packages/db/package.json ./packages/db/
COPY packages/types/package.json ./packages/types/
COPY packages/ai/package.json ./packages/ai/

# --omit=dev : @swc-node/register et @swc/core sont en dependencies, pas en
# devDependencies, précisément pour survivre à cette ligne.
#
# --workspace=@recruitai/api : n'installe que l'API et ses dépendances. Sans
# ce filtre, npm installe aussi Next.js et React pour apps/web, que l'API
# n'exécute jamais — l'image passait de ~400 Mo à près d'1 Go.
RUN npm ci --omit=dev --workspace=@recruitai/api --include-workspace-root

# Sources : uniquement ce que l'API exécute.
COPY packages ./packages
COPY apps/api ./apps/api

# Indicatif : le port réel est imposé par l'hébergeur via la variable PORT,
# que main.ts lit en priorité.
EXPOSE 8000

CMD ["npm", "run", "start", "--workspace=@recruitai/api"]
