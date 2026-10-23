resource "docker_image" "web" {
  name = "${var.project}-web:local"

  build {
    context    = local.repo_root
    dockerfile = "apps/web/Dockerfile"
    build_args = {
      VITE_TURNSTILE_SITE_KEY = var.turnstile_site_key
    }
  }

  triggers = {
    source = sha1(join("", [
      for f in sort(concat(
        tolist(fileset(local.repo_root, "apps/web/src/**")),
        tolist(fileset(local.repo_root, "packages/sdk/src/**")),
        tolist(fileset(local.repo_root, "packages/shared-types/src/**")),
        ["apps/web/package.json", "apps/web/Dockerfile", "apps/web/nginx.conf", "pnpm-lock.yaml"],
      )) : filesha1("${local.repo_root}/${f}")
    ]))
  }
}

resource "docker_container" "web" {
  name      = "${var.project}-web"
  image     = docker_image.web.image_id
  restart   = "unless-stopped"
  read_only = true

  tmpfs = {
    "/tmp" = "rw,noexec,nosuid,size=16m"
  }

  security_opts = ["no-new-privileges:true"]

  ports {
    internal = 8080
    external = var.web_host_port
    ip       = "127.0.0.1"
  }

  networks_advanced {
    name = docker_network.backend.name
  }

  depends_on = [docker_container.api]
}
