variable "docker_host" {
  description = "Docker daemon to deploy to."
  type        = string
  default     = "unix:///var/run/docker.sock"
}

variable "project" {
  description = "Prefix for container, network and volume names."
  type        = string
  default     = "taskflow"
}

variable "public_url" {
  description = "Origin the browser uses to reach TaskFlow. Used for auth callbacks and CORS."
  type        = string
  default     = "http://localhost:8080"
}

variable "web_host_port" {
  description = "Port on 127.0.0.1 that serves the web app."
  type        = number
  default     = 8080
}

variable "postgres_host_port" {
  description = "Port on 127.0.0.1 for local database tools. Set to null to keep the database private."
  type        = number
  default     = 5432
  nullable    = true
}

variable "postgres_db" {
  type    = string
  default = "taskflow"
}

variable "postgres_superuser" {
  type    = string
  default = "postgres"
}

variable "app_db_owner" {
  description = "Role that owns the schema and runs migrations. Only the migrate job uses it."
  type        = string
  default     = "taskflow_owner"
}

variable "app_db_user" {
  description = "Least-privilege role the API connects as: data access only, subject to row-level security."
  type        = string
  default     = "taskflow_app"
}

variable "postgres_password" {
  description = "Password for the Postgres superuser. Only the init script uses it."
  type        = string
  sensitive   = true
}

variable "app_db_owner_password" {
  description = "Password for the schema owner role."
  type        = string
  sensitive   = true
}

variable "app_db_password" {
  description = "Password for the API's database role."
  type        = string
  sensitive   = true
}

variable "better_auth_secret" {
  description = "At least 32 random characters, e.g. `openssl rand -base64 48`."
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.better_auth_secret) >= 32
    error_message = "better_auth_secret must be at least 32 characters."
  }
}

variable "turnstile_secret_key" {
  description = "Cloudflare Turnstile secret. Production builds require one; the default is Cloudflare's public test secret, which always passes."
  type        = string
  default     = "1x0000000000000000000000000000000AA"
  sensitive   = true
}

variable "smtp_url" {
  description = "Outgoing mail for password resets. The default sends to the local Mailpit inbox."
  type        = string
  default     = "smtp://mailpit:1025"
  sensitive   = true
}

variable "mail_from" {
  description = "Sender address for account emails."
  type        = string
  default     = "TaskFlow <no-reply@taskflow.localhost>"
}

variable "mailpit_ui_port" {
  description = "Port on 127.0.0.1 for the Mailpit inbox UI."
  type        = number
  default     = 8025
}

variable "turnstile_site_key" {
  description = "Cloudflare Turnstile site key, baked into the web build. The default is Cloudflare's public test key."
  type        = string
  default     = "1x00000000000000000000AA"
}
