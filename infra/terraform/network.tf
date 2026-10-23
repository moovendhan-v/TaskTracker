resource "docker_network" "backend" {
  name = "${var.project}-backend"
}
