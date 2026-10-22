output "web_url" {
  description = "Open this in the browser."
  value       = "http://localhost:${var.web_host_port}"
}

output "api_docs_url" {
  description = "Swagger UI is off in production builds; run the API with NODE_ENV=development to use it."
  value       = "http://localhost:${var.web_host_port}/api/health"
}
