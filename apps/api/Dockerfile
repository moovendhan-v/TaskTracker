# syntax=docker/dockerfile:1.7
# Build context: repository root (the API depends on workspace packages).

FROM node:22.22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared-types/package.json packages/shared-types/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @taskflow/api...
COPY packages/shared-types packages/shared-types
COPY apps/api apps/api
RUN pnpm --filter @taskflow/shared-types build \
 && pnpm --filter @taskflow/api build \
 && pnpm --filter @taskflow/api deploy --prod --legacy /out

FROM node:22.22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "--enable-source-maps", "dist/main.js"]
