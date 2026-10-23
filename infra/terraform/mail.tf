# Local inbox for password reset emails (http://localhost:8025). Nothing leaves the machine.
resource "docker_image" "mailpit" {
  name         = "axllent/mailpit:v1.31.4"
  keep_locally = true
}

resource "docker_container" "mailpit" {
  name          = "${var.project}-mailpit"
  image         = docker_image.mailpit.image_id
  restart       = "unless-stopped"
  read_only     = true
  security_opts = ["no-new-privileges:true"]

  # Mailpit keeps its message store in a temporary file, deleted on exit.
  tmpfs = {
    "/tmp" = "rw,noexec,nosuid,size=64m"
  }

  ports {
    internal = 8025
    external = var.mailpit_ui_port
    ip       = "127.0.0.1"
  }

  networks_advanced {
    name    = docker_network.backend.name
    aliases = ["mailpit"]
  }
}
