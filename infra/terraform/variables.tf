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

variable "app_db_user" {
  description = "Least-privilege role the API connects as."
  type        = string
  default     = "taskflow"
}

variable "postgres_password" {
  description = "Password for the Postgres superuser. Only the init script uses it."
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
  description = "Cloudflare Turnstile secret. Leave empty to turn the CAPTCHA off locally."
  type        = string
  default     = ""
  sensitive   = true
}

variable "turnstile_site_key" {
  description = "Cloudflare Turnstile site key, baked into the web build."
  type        = string
  default     = ""
}
