# syntax=docker/dockerfile:1.7
# Build context: repository root (the web app depends on workspace packages).

FROM node:22.22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/sdk/package.json packages/sdk/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @taskflow/web...
COPY packages/shared-types packages/shared-types
COPY packages/sdk packages/sdk
COPY apps/web apps/web
ARG VITE_TURNSTILE_SITE_KEY=""
ENV VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY
RUN pnpm --filter @taskflow/shared-types build \
 && pnpm --filter @taskflow/sdk build \
 && pnpm --filter @taskflow/web build

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
# Rendered at start-up (envsubst) into /tmp, which stays writable in the read-only container.
COPY apps/web/security-headers.conf.template /etc/nginx/templates/security-headers.conf.template
ENV NGINX_ENVSUBST_OUTPUT_DIR=/tmp/nginx-snippets \
    LIVEKIT_CONNECT_SRC=
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
