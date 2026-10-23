#!/bin/sh
# Creates (or recreates) a throwaway "taskflow_test" database inside the local Docker
# Postgres (`pnpm db:up`), with its own owner and runtime roles made by the same script
# as production. Writes the connection strings to .env.e2e (git-ignored), which both
# e2e suites load. Usage: sh scripts/create-e2e-database.sh
set -eu
cd "$(dirname "$0")/.."
compose="docker compose -f infra/docker/docker-compose.yml --env-file .env"
owner_password=$(openssl rand -hex 24)
app_password=$(openssl rand -hex 24)

$compose exec -T postgres sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres \
  -c "DROP DATABASE IF EXISTS taskflow_test WITH (FORCE)" \
  -c "DROP ROLE IF EXISTS taskflow_test_owner" -c "DROP ROLE IF EXISTS taskflow_test_app" \
  -c "CREATE DATABASE taskflow_test"' >/dev/null

$compose exec -T \
  -e POSTGRES_DB=taskflow_test \
  -e APP_DB_OWNER=taskflow_test_owner -e APP_DB_OWNER_PASSWORD="$owner_password" \
  -e APP_DB_USER=taskflow_test_app -e APP_DB_PASSWORD="$app_password" \
  postgres sh /docker-entrypoint-initdb.d/01-app-role.sh >/dev/null

port=$(grep -E '^POSTGRES_HOST_PORT=' .env | cut -d= -f2)
umask 077
cat > .env.e2e <<ENV
E2E_DATABASE_URL=postgres://taskflow_test_app:$app_password@localhost:${port:-5432}/taskflow_test
E2E_MIGRATION_DATABASE_URL=postgres://taskflow_test_owner:$owner_password@localhost:${port:-5432}/taskflow_test
ENV
echo "Created taskflow_test and wrote .env.e2e. Run: pnpm build && pnpm test:e2e"
