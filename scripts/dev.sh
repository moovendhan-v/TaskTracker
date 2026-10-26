#!/usr/bin/env bash
# One command for a local dev environment in Docker.
#
#   ./scripts/dev.sh            create .env if missing, start everything, follow the logs
#   ./scripts/dev.sh down       stop the stack (keeps the database)
#   ./scripts/dev.sh reset      stop and delete the database and dependency volumes
#   ./scripts/dev.sh logs       follow the API and web logs
#   ./scripts/dev.sh bootstrap  re-run install, build, migrations and seed
#   ./scripts/dev.sh env        only create .env
#
# Needs Docker with Compose v2. Nothing else: Node, pnpm and Postgres run in containers.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env"
COMPOSE=(docker compose -f "$ROOT/infra/docker/docker-compose.dev.yml")
# Optional local tweaks (e.g. a corporate proxy's CA certificate), git-ignored.
OVERRIDE="$ROOT/infra/docker/docker-compose.dev.override.yml"
[[ -f "$OVERRIDE" ]] && COMPOSE+=(-f "$OVERRIDE")
COMPOSE+=(--env-file "$ENV_FILE")

# The API and web containers run as you, so files they write stay yours.
export DEV_UID="${DEV_UID:-$(id -u)}"
export DEV_GID="${DEV_GID:-$(id -g)}"

secret() {
  if command -v openssl >/dev/null 2>&1; then openssl rand -hex 24
  else LC_ALL=C tr -dc 'a-f0-9' </dev/urandom | head -c 48; fi
}

# Copies .env.example to .env and fills every secret with a fresh random value.
# Values stay on this machine: .env is git-ignored and never printed.
create_env() {
  if [[ -f "$ENV_FILE" ]]; then
    echo "Using existing .env"
    return
  fi
  local owner app pg redis auth seed
  owner="$(secret)"; app="$(secret)"; pg="$(secret)"; redis="$(secret)"; auth="$(secret)$(secret)"; seed="$(secret | head -c 20)"
  while IFS= read -r line || [[ -n "$line" ]]; do
    case "$line" in
      DATABASE_URL=*) echo "DATABASE_URL=postgres://taskflow_app:${app}@localhost:5432/taskflow" ;;
      MIGRATION_DATABASE_URL=*) echo "MIGRATION_DATABASE_URL=postgres://taskflow_owner:${owner}@localhost:5432/taskflow" ;;
      BETTER_AUTH_SECRET=) echo "BETTER_AUTH_SECRET=${auth}" ;;
      POSTGRES_PASSWORD=) echo "POSTGRES_PASSWORD=${pg}" ;;
      APP_DB_OWNER_PASSWORD=) echo "APP_DB_OWNER_PASSWORD=${owner}" ;;
      APP_DB_PASSWORD=) echo "APP_DB_PASSWORD=${app}" ;;
      REDIS_PASSWORD=) echo "REDIS_PASSWORD=${redis}" ;;
      SEED_PASSWORD=) echo "SEED_PASSWORD=${seed}" ;;
      *) echo "$line" ;;
    esac
  done <"$ROOT/.env.example" >"$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo "Created .env with fresh random secrets (git-ignored, readable only by you)."
}

urls() {
  # Read the port overrides the stack uses, if any.
  local web api mail
  web="$(grep -E '^WEB_DEV_PORT=' "$ENV_FILE" | cut -d= -f2)"; api="$(grep -E '^API_HOST_PORT=' "$ENV_FILE" | cut -d= -f2)"; mail="$(grep -E '^MAILPIT_UI_PORT=' "$ENV_FILE" | cut -d= -f2)"
  cat <<INFO

TaskFlow dev stack is up:
  App      http://localhost:${web:-5173}
  API      http://localhost:${api:-3000}/api/graphql
  Mail     http://localhost:${mail:-8025}
Demo accounts: avery@example.com, jordan@example.com, sam@example.com, kai@example.com
  (password: SEED_PASSWORD in .env)

Following logs; Ctrl+C stops following, the stack keeps running. Stop it with: ./scripts/dev.sh down
INFO
}

cmd="${1:-up}"
case "$cmd" in
  env)
    create_env ;;
  up)
    create_env
    "${COMPOSE[@]}" up -d --wait postgres redis mailpit
    # Bootstrap prints its progress; the API and web start once it succeeds.
    "${COMPOSE[@]}" run --rm bootstrap
    "${COMPOSE[@]}" up -d --wait --no-deps api web
    urls
    "${COMPOSE[@]}" logs -f --tail 20 api web ;;
  bootstrap)
    "${COMPOSE[@]}" run --rm bootstrap ;;
  logs)
    "${COMPOSE[@]}" logs -f --tail 50 api web ;;
  down)
    "${COMPOSE[@]}" down ;;
  reset)
    read -r -p "Delete the dev database and dependency volumes? [y/N] " answer
    [[ "$answer" =~ ^[Yy]$ ]] && "${COMPOSE[@]}" down -v ;;
  *)
    sed -n '2,12p' "$0"; exit 1 ;;
esac
