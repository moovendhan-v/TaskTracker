#!/bin/sh
# One-off setup for the dev stack (docker-compose.dev.yml), run on every `up`.
# Each step is idempotent: install is skipped when nothing changed, migrations
# skip what has run, and the demo seed skips an existing demo workspace.
set -eu

step() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }

LOCK_HASH_FILE="/pnpm-store/.pnpm-lock.hash"
CURRENT_LOCK_HASH=""
if command -v sha256sum >/dev/null 2>&1; then
  CURRENT_LOCK_HASH="$(sha256sum pnpm-lock.yaml 2>/dev/null | cut -d' ' -f1 || true)"
elif command -v md5sum >/dev/null 2>&1; then
  CURRENT_LOCK_HASH="$(md5sum pnpm-lock.yaml 2>/dev/null | cut -d' ' -f1 || true)"
fi

NEEDS_INSTALL=0
if [ ! -d "node_modules" ] || [ ! -d "apps/api/node_modules" ] || [ ! -d "apps/web/node_modules" ]; then
  NEEDS_INSTALL=1
elif [ -n "$CURRENT_LOCK_HASH" ]; then
  STORED_HASH="$(cat "$LOCK_HASH_FILE" 2>/dev/null || true)"
  if [ "$CURRENT_LOCK_HASH" != "$STORED_HASH" ]; then
    NEEDS_INSTALL=1
  fi
fi

export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
corepack enable
pnpm config set store-dir /pnpm-store >/dev/null

if [ "$NEEDS_INSTALL" -eq 1 ]; then
  step "Installing dependencies (first run or lockfile changed)"
  pnpm install --frozen-lockfile
  [ -n "$CURRENT_LOCK_HASH" ] && echo "$CURRENT_LOCK_HASH" > "$LOCK_HASH_FILE" 2>/dev/null || true

  step "Fixing node_modules file ownership for uid ${DEV_UID:-1000}"
  chown -R "${DEV_UID:-1000}:${DEV_GID:-1000}" \
    node_modules apps/api/node_modules apps/web/node_modules packages/sdk/node_modules packages/shared-types/node_modules 2>/dev/null || true
else
  step "Dependencies up-to-date (cached)"
fi

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

step "Fixing build output and web node_modules ownership for uid ${DEV_UID:-1000}"
rm -rf apps/web/node_modules/.vite-temp 2>/dev/null || true
chown -R "${DEV_UID:-1000}:${DEV_GID:-1000}" \
  apps/api/dist packages/shared-types/dist packages/sdk/dist apps/web/node_modules 2>/dev/null || true
chown "${DEV_UID:-1000}:${DEV_GID:-1000}" \
  node_modules apps/api/node_modules packages/sdk/node_modules packages/shared-types/node_modules 2>/dev/null || true

step "Bootstrap done"
