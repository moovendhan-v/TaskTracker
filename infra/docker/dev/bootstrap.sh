#!/bin/sh
# One-off setup for the dev stack (docker-compose.dev.yml), run on every `up`.
# Each step is idempotent: install is a no-op when nothing changed, migrations
# skip what has run, and the demo seed skips an existing demo workspace.
set -eu

step() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }

step "Installing dependencies"
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
corepack enable
pnpm config set store-dir /pnpm-store >/dev/null
pnpm install --frozen-lockfile

step "Building shared packages and the API"
pnpm --filter @taskflow/shared-types build
pnpm --filter @taskflow/sdk build
pnpm --filter @taskflow/api build

step "Applying database migrations (as the schema owner)"
node apps/api/dist/cli/run-migrations.js

if [ "${SEED_DEMO:-true}" = "true" ]; then
  if [ -n "${SEED_PASSWORD:-}" ]; then
    step "Seeding the demo workspace"
    # The seed connects as the least-privilege role, like the API itself.
    unset MIGRATION_DATABASE_URL
    node apps/api/dist/cli/seed-demo.js
  else
    echo "SEED_PASSWORD is empty, skipping the demo seed."
  fi
fi

# The API and web containers run as your user, so they can write build output
# and dependencies; hand those over (the volumes start out owned by root).
step "Fixing file ownership for uid ${DEV_UID:-1000}"
chown -R "${DEV_UID:-1000}:${DEV_GID:-1000}" \
  node_modules apps/api/node_modules apps/web/node_modules packages/sdk/node_modules packages/shared-types/node_modules \
  apps/api/dist packages/shared-types/dist packages/sdk/dist 2>/dev/null || true

step "Bootstrap done"
