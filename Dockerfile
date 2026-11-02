FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml tsconfig.json ./
COPY src ./src
COPY drizzle ./drizzle
COPY content ./content
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Set RUN_SEED=1 in Coolify only when you need to (re)load CEFR JSON into Postgres.
ENV RUN_SEED=0
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/content ./content
USER node
CMD ["sh", "-c", "node dist/db/migrate.js && if [ \"$RUN_SEED\" = \"1\" ]; then node dist/content/load-seeds.js; fi && node dist/index.js"]
