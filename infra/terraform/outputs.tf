output "web_url" {
  description = "Open this in the browser."
  value       = "http://localhost:${var.web_host_port}"
}

output "graphql_url" {
  description = "GraphQL endpoint. Introspection is off in production builds; the schema is in packages/sdk/schema.graphql."
  value       = "http://localhost:${var.web_host_port}/api/graphql"
}
