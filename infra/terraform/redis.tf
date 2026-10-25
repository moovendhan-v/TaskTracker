# Shared cache. Memory only (no snapshots), password protected, reachable only on the backend network.
resource "docker_image" "redis" {
  name         = "redis:7.4.2-alpine"
  keep_locally = true
}

resource "docker_container" "redis" {
  name          = "${var.project}-redis"
  image         = docker_image.redis.image_id
  restart       = "unless-stopped"
  read_only     = true
  security_opts = ["no-new-privileges:true"]
  env           = ["REDIS_PASSWORD=${var.redis_password}"]
  command = [
    "sh", "-c",
    "exec redis-server --requirepass \"$REDIS_PASSWORD\" --save '' --appendonly no --maxmemory 256mb --maxmemory-policy allkeys-lru",
  ]

  tmpfs = {
    "/data" = "rw,noexec,nosuid,size=16m"
  }

  networks_advanced {
    name    = docker_network.backend.name
    aliases = ["redis"]
  }
}
