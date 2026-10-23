locals {
  repo_root = abspath("${path.module}/../..")

  api_env = [
    "NODE_ENV=production",
    "PORT=3000",
    "DATABASE_URL=postgres://${var.app_db_user}:${urlencode(var.app_db_password)}@postgres:5432/${var.postgres_db}",
    "DATABASE_SSL=false",
    "BETTER_AUTH_SECRET=${var.better_auth_secret}",
    "BETTER_AUTH_URL=${var.public_url}",
    "CORS_ORIGINS=${var.public_url}",
    "TRUST_PROXY=1",
    "TURNSTILE_SECRET_KEY=${var.turnstile_secret_key}",
    "SMTP_URL=${var.smtp_url}",
    "MAIL_FROM=${var.mail_from}",
  ]
}

resource "docker_image" "api" {
  name = "${var.project}-api:local"

  build {
    context    = local.repo_root
    dockerfile = "apps/api/Dockerfile"
  }

  # Rebuild when API or shared-types sources change.
  triggers = {
    source = sha1(join("", [
      for f in sort(concat(
        tolist(fileset(local.repo_root, "apps/api/src/**")),
        tolist(fileset(local.repo_root, "packages/shared-types/src/**")),
        ["apps/api/package.json", "apps/api/Dockerfile", "pnpm-lock.yaml"],
      )) : filesha1("${local.repo_root}/${f}")
    ]))
  }
}

# One-off: Better Auth tables, then TaskFlow migrations. Terraform waits for it to exit.
resource "docker_container" "migrate" {
  name    = "${var.project}-migrate"
  image   = docker_image.api.image_id
  command = ["node", "dist/cli/run-migrations.js"]
  # Only the migrate job gets the owner role, which can change the schema.
  env = concat(local.api_env, [
    "MIGRATION_DATABASE_URL=postgres://${var.app_db_owner}:${urlencode(var.app_db_owner_password)}@postgres:5432/${var.postgres_db}",
  ])
  must_run = false
  attach   = true
  logs     = true

  networks_advanced {
    name = docker_network.backend.name
  }

  depends_on = [docker_container.postgres]
}

resource "docker_container" "api" {
  name      = "${var.project}-api"
  image     = docker_image.api.image_id
  restart   = "unless-stopped"
  env       = local.api_env
  read_only = true

  tmpfs = {
    "/tmp" = "rw,noexec,nosuid,size=16m"
  }

  security_opts = ["no-new-privileges:true"]

  wait         = true
  wait_timeout = 120

  networks_advanced {
    name    = docker_network.backend.name
    aliases = ["api"]
  }

  depends_on = [docker_container.migrate, docker_container.mailpit]
}
