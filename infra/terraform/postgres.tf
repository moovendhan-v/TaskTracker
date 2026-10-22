resource "docker_image" "postgres" {
  name         = "postgres:16.6-alpine"
  keep_locally = true
}

resource "docker_volume" "pgdata" {
  name = "${var.project}-pgdata"
}

resource "docker_container" "postgres" {
  name    = "${var.project}-postgres"
  image   = docker_image.postgres.image_id
  restart = "unless-stopped"

  env = [
    "POSTGRES_USER=${var.postgres_superuser}",
    "POSTGRES_PASSWORD=${var.postgres_password}",
    "POSTGRES_DB=${var.postgres_db}",
    "APP_DB_USER=${var.app_db_user}",
    "APP_DB_PASSWORD=${var.app_db_password}",
  ]

  upload {
    file       = "/docker-entrypoint-initdb.d/01-app-role.sh"
    source     = abspath("${path.module}/../docker/postgres/01-app-role.sh")
    executable = true
  }

  volumes {
    volume_name    = docker_volume.pgdata.name
    container_path = "/var/lib/postgresql/data"
  }

  dynamic "ports" {
    for_each = var.postgres_host_port == null ? [] : [var.postgres_host_port]
    content {
      internal = 5432
      external = ports.value
      ip       = "127.0.0.1"
    }
  }

  healthcheck {
    test     = ["CMD-SHELL", "pg_isready -U ${var.postgres_superuser} -d ${var.postgres_db}"]
    interval = "5s"
    timeout  = "3s"
    retries  = 20
  }

  # Block until the healthcheck passes so migrations don't start too early.
  wait         = true
  wait_timeout = 120

  networks_advanced {
    name    = docker_network.backend.name
    aliases = ["postgres"]
  }
}
