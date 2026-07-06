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

FROM node:lts-alpine AS prod-deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/validators/package.json packages/validators/package.json
COPY packages/trpc/package.json packages/trpc/package.json
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

FROM node:lts-alpine AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app ./
COPY . .
RUN find . -name "*.tsbuildinfo" -delete \
  && pnpm --filter @cloudcommerce/types build \
  && pnpm --filter @cloudcommerce/trpc build \
  && pnpm --filter @cloudcommerce/validators build \
  && pnpm --filter @cloudcommerce/database build \
  && pnpm --filter @cloudcommerce/api build

FROM node:lts-alpine AS runtime
WORKDIR /app/apps/api
ENV NODE_ENV=production
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 4000) + '/health/live').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
USER node
COPY --from=prod-deps /app /app
COPY --from=build /app/apps/api/dist /app/apps/api/dist
COPY --from=build /app/packages/database/dist /app/packages/database/dist
COPY --from=build /app/packages/trpc/dist /app/packages/trpc/dist
COPY --from=build /app/packages/types/dist /app/packages/types/dist
COPY --from=build /app/packages/validators/dist /app/packages/validators/dist
CMD ["node", "dist/index.js"]
