#!/usr/bin/env bash
# One command for a local dev environment in Docker.
#
#   ./scripts/dev.sh            create .env if missing, pick free ports, start everything, follow the logs
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
  local owner app pg redis auth seed minio
  owner="$(secret)"; app="$(secret)"; pg="$(secret)"; redis="$(secret)"; auth="$(secret)$(secret)"; seed="$(secret | head -c 20)"; minio="$(secret)"
  while IFS= read -r line || [[ -n "$line" ]]; do
    case "$line" in
      DATABASE_URL=*) echo "DATABASE_URL=postgres://taskflow_app:${app}@localhost:5432/taskflow" ;;
      MIGRATION_DATABASE_URL=*) echo "MIGRATION_DATABASE_URL=postgres://taskflow_owner:${owner}@localhost:5432/taskflow" ;;
      BETTER_AUTH_SECRET=) echo "BETTER_AUTH_SECRET=${auth}" ;;
      POSTGRES_PASSWORD=) echo "POSTGRES_PASSWORD=${pg}" ;;
      APP_DB_OWNER_PASSWORD=) echo "APP_DB_OWNER_PASSWORD=${owner}" ;;
      APP_DB_PASSWORD=) echo "APP_DB_PASSWORD=${app}" ;;
      REDIS_PASSWORD=) echo "REDIS_PASSWORD=${redis}" ;;
      MINIO_ROOT_PASSWORD=) echo "MINIO_ROOT_PASSWORD=${minio}" ;;
      DEV_LIVEKIT_API_SECRET=) echo "DEV_LIVEKIT_API_SECRET=$(secret)" ;;
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
  local -a keys=(BETTER_AUTH_SECRET POSTGRES_PASSWORD APP_DB_OWNER_PASSWORD APP_DB_PASSWORD REDIS_PASSWORD MINIO_ROOT_PASSWORD DEV_LIVEKIT_API_SECRET SEED_PASSWORD SEED_DEMO)
  generated() {
    case "$1" in
      BETTER_AUTH_SECRET) echo "$(secret)$(secret)" ;;
      SEED_PASSWORD) secret | head -c 20 ;;
      SEED_DEMO) echo true ;;
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

env_value() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- || true; }

env_set() {
  local tmp
  tmp="$(mktemp)"
  grep -vE "^$1=" "$ENV_FILE" >"$tmp" || true
  printf '%s=%s\n' "$1" "$2" >>"$tmp"
  mv "$tmp" "$ENV_FILE"; chmod 600 "$ENV_FILE"
}

# True when something on this machine accepts connections on the port.
port_busy() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

# Gives each published port a free number. Nothing that already runs is stopped:
# a taken port just moves to the next free one, saved in .env. Skipped while
# this stack is running, since its own containers hold the ports then.
pick_ports() {
  if [[ -n "$("${COMPOSE[@]}" ps -q 2>/dev/null)" ]]; then return; fi
  local entry key port start
  for entry in DEV_WEB_PORT:5180 DEV_API_PORT:3100 DEV_POSTGRES_PORT:55432 DEV_MAIL_PORT:8125 DEV_MINIO_CONSOLE_PORT:9101 DEV_LIVEKIT_PORT:7880; do
    key="${entry%%:*}"
    port="$(env_value "$key")"; port="${port:-${entry#*:}}"
    start="$port"
    while port_busy "$port"; do port=$((port + 1)); done
    if [[ "$port" != "$start" ]]; then echo "Port $start is taken; using $port for $key."; fi
    if [[ "$port" != "$(env_value "$key")" ]]; then env_set "$key" "$port"; fi
  done
}

urls() {
  cat <<INFO

TaskFlow dev stack is up:
  App      http://localhost:$(env_value DEV_WEB_PORT)
  API      http://localhost:$(env_value DEV_API_PORT)/api/graphql
  Mail     http://localhost:$(env_value DEV_MAIL_PORT)
  Files    http://localhost:$(env_value DEV_MINIO_CONSOLE_PORT) (MinIO console; MINIO_ROOT_USER / MINIO_ROOT_PASSWORD in .env)
  Calls    ws://localhost:$(env_value DEV_LIVEKIT_PORT) (LiveKit)
  Postgres localhost:$(env_value DEV_POSTGRES_PORT)
Demo accounts: avery@example.com, jordan@example.com, sam@example.com, kai@example.com
  (password: SEED_PASSWORD in .env)

Following logs; Ctrl+C stops following, the stack keeps running. Stop it with: ./scripts/dev.sh down
INFO
}

# Postgres sets the app roles' passwords once, when its data volume is first created.
# If .env changed since (recreated, edited, or an older one filled in), migrations fail
# with "password authentication failed". Set them from .env again on every start; the
# container has the current values and connects over its own socket.
sync_db_roles() {
  "${COMPOSE[@]}" exec -T postgres sh -c 'psql -q -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    -v owner="$APP_DB_OWNER" -v owner_password="$APP_DB_OWNER_PASSWORD" \
    -v app_user="$APP_DB_USER" -v app_password="$APP_DB_PASSWORD"' <<'SQL'
ALTER ROLE :"owner" WITH PASSWORD :'owner_password';
ALTER ROLE :"app_user" WITH PASSWORD :'app_password';
SQL
}

cmd="${1:-up}"
case "$cmd" in
  env)
    create_env ;;
  up)
    create_env
    pick_ports
    "${COMPOSE[@]}" up -d --wait postgres redis mailpit livekit
    sync_db_roles
    # Bootstrap prints its progress; the API and web start once it succeeds.
    "${COMPOSE[@]}" run --rm bootstrap
    # Recreated every time: a running Vite or API keeps what it resolved at start, so packages the
    # bootstrap step just installed (e.g. after a pull) would stay "Failed to resolve import".
    "${COMPOSE[@]}" up -d --wait --no-deps --force-recreate api web
    urls
    "${COMPOSE[@]}" logs -f --tail 20 api web ;;
  bootstrap)
    "${COMPOSE[@]}" up -d --wait postgres
    sync_db_roles
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
