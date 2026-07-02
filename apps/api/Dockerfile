FROM node:lts-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/validators/package.json packages/validators/package.json
COPY packages/trpc/package.json packages/trpc/package.json
RUN pnpm install --frozen-lockfile

FROM node:lts-alpine AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @cloudcommerce/api build

FROM node:lts-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
USER node
COPY --from=build /app/apps/api/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
CMD ["node", "dist/index.js"]
