#!/usr/bin/env bash
# One command for a local dev environment in Docker.
#
#   ./scripts/dev.sh            create .env if missing, free the ports, start everything, follow the logs
#   ./scripts/dev.sh -y         same, without asking before stopping whatever holds the ports
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
    complete_env
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

# Fills settings an older .env lacks (or left empty) without touching the rest.
complete_env() {
  local key value added=() tmp
  tmp="$(mktemp)"
  local -a keys=(BETTER_AUTH_SECRET POSTGRES_PASSWORD APP_DB_OWNER_PASSWORD APP_DB_PASSWORD REDIS_PASSWORD SEED_PASSWORD SEED_DEMO WEB_DEV_PORT API_HOST_PORT)
  generated() {
    case "$1" in
      BETTER_AUTH_SECRET) echo "$(secret)$(secret)" ;;
      SEED_PASSWORD) secret | head -c 20 ;;
      SEED_DEMO) echo true ;;
      WEB_DEV_PORT) echo 5173 ;;
      API_HOST_PORT) echo 3000 ;;
      *) secret ;;
    esac
  }
  cp "$ENV_FILE" "$tmp"
  for key in "${keys[@]}"; do
    if grep -qE "^${key}=.+" "$tmp"; then continue; fi
    value="$(generated "$key")"
    if grep -qE "^${key}=$" "$tmp"; then
      grep -vE "^${key}=$" "$tmp" >"$tmp.next"; mv "$tmp.next" "$tmp"
    fi
    printf '%s=%s\n' "$key" "$value" >>"$tmp"
    added+=("$key")
  done
  if ((${#added[@]})); then
    mv "$tmp" "$ENV_FILE"; chmod 600 "$ENV_FILE"
    echo "Added to .env: ${added[*]}"
  else
    rm -f "$tmp"
  fi
}

env_value() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2-; }

ASSUME_YES=false
confirm() {
  $ASSUME_YES && return 0
  local answer
  printf '%s [Y/n] ' "$1"
  read -r answer || answer=n
  [[ -z "$answer" || "$answer" =~ ^[Yy] ]]
}

# Frees the ports the stack publishes. Another TaskFlow stack (e.g. `pnpm infra:up`)
# is stopped without asking (its data is kept); anything else is shown and stopped
# only after you agree.
free_ports() {
  local port rows row project name pids pid
  local -a ports=("$(env_value POSTGRES_HOST_PORT)" "$(env_value API_HOST_PORT)" "$(env_value WEB_DEV_PORT)" "$(env_value MAILPIT_UI_PORT)")
  ports=("${ports[0]:-5432}" "${ports[1]:-3000}" "${ports[2]:-5173}" "${ports[3]:-8025}")
  for port in "${ports[@]}"; do
    # Containers publishing the port, other than this dev stack's own.
    # (Collected first, so the prompts below read from the keyboard.)
    rows="$(docker ps --filter "publish=$port" --format '{{.Names}}|{{.Label "com.docker.compose.project"}}')"
    for row in $rows; do
      name="${row%%|*}"; project="${row#*|}"
      [[ "$project" == "taskflow-dev" ]] && continue
      if [[ "$project" == "taskflow" ]]; then
        echo "Port $port is used by the other TaskFlow stack ($name); stopping that stack (its data is kept)."
        docker ps -q --filter "label=com.docker.compose.project=taskflow" | xargs docker stop >/dev/null
      elif confirm "Port $port is used by container '$name'. Stop it?"; then
        docker stop "$name" >/dev/null
      else
        echo "Port $port is still in use; set a different port in .env and try again." >&2; exit 1
      fi
    done

    # Programs on this machine listening on the port (e.g. a Homebrew Postgres).
    command -v lsof >/dev/null 2>&1 || continue
    pids="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | sort -u || true)"
    for pid in $pids; do
      name="$(ps -p "$pid" -o comm= 2>/dev/null || echo unknown)"
      # Docker's own port forwarders belong to the containers handled above.
      [[ "$name" =~ (com\.docker|vpnkit|docker-proxy|dockerd) ]] && continue
      if confirm "Port $port is used by '$name' (pid $pid). Stop it?"; then
        kill "$pid" 2>/dev/null || true
        sleep 1
        kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null || true
      else
        echo "Port $port is still in use; set a different port in .env and try again." >&2; exit 1
      fi
    done
  done
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

if [[ "${1:-}" == "-y" || "${1:-}" == "--yes" ]]; then ASSUME_YES=true; shift; fi
cmd="${1:-up}"
case "$cmd" in
  env)
    create_env ;;
  up)
    create_env
    free_ports
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
