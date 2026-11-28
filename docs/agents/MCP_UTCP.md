# AI assistants: MCP and UTCP (E6.5)

TaskFlow's whole GraphQL API is available to AI agents as tools over two protocols:

| Protocol | Endpoint | Notes |
|---|---|---|
| **MCP** (Model Context Protocol) | `POST /api/mcp` | Streamable HTTP, stateless, JSON responses (no server-sent stream). Protocol versions 2025-06-18, 2025-03-26, 2024-11-05. Methods: `initialize`, `ping`, `tools/list`, `tools/call`. |
| **UTCP** (Universal Tool Calling Protocol) 1.0 | `GET /api/utcp` (the manual) | Each tool has an HTTP call template: `POST /api/agent/tools/{name}`, with the arguments as the JSON body (`body_field: "body"`) and the token as `Authorization: Bearer ${TASKFLOW_TOKEN}`. |

Both run the same tool catalog through the same executor. No SDK or extra dependency is needed:
the protocol code is small and lives in `apps/api/src/modules/agent-api`.

## Tokens

Each person makes a token under **Security → AI assistants**. It is shown once and only its hash
is stored. A token has a name (it labels the agent's work), an access level and an expiry of 30,
90 or 365 days:

- **Read only** (`read`): queries only.
- **Read and change** (`read`, `write`): queries and mutations.

A token acts as its owner in one workspace, with the owner's role as it is today. It never uses a
platform-admin role. Removing the owner from the workspace, or revoking the token, stops it at
once.

## Tools are generated, not written by hand

At startup, `AgentToolCatalog` reads every GraphQL query and mutation, so new features appear
without any MCP or UTCP code. An operation becomes a tool when all of these hold:

1. It takes a `workspaceId`. The agent never sends this; it comes from the token.
2. It isn't platform-admin only.
3. Every permission it needs is one an agent may use: `task.view`, `task.create`, `task.update`,
   `task.assign`, `doc.view`, `doc.create`, `time.log`, `sprint.manage`. Administration stays with
   people: workspace, members, roles, policies, integrations, HR and the audit log.
4. It isn't destructive. Names starting `delete`, `remove`, `revoke`, `rotate`, `leave`, `archive`
   and similar are excluded.
5. It isn't security-related: sign-in, tokens, passkeys, SSO, webhooks, intake keys, share links,
   roles and access settings, attendance clocking.
6. A membership-only mutation (no permission named) needs `@AgentTool(true)` to be included.

`@AgentTool(false)` on a resolver method hides that operation. A tool's input schema comes from
the GraphQL arguments, and its result is the operation's plain fields two levels deep.

## How a call runs

`AgentToolsService` executes the real GraphQL operation as the token's owner. That means the same
resolvers, guards (permissions, space rules, required two-step), validation pipes, throttling and
row-level security apply as for a person in the app. Arguments the operation doesn't declare are
refused. Model output is treated as untrusted input: it goes through GraphQL coercion and class
validation like any request.

## Marking AI work and auditing it

- Changes made during a tool call carry the agent's name. Task history (`task_activity.agent`)
  and comments (`task_comment.agent`) show **“AI · <name>”**.
- Every call is written to the workspace audit log as `agent.<tool>`: reads and writes, successes
  and failures alike. The entry records the agent, token, protocol, tool, resource ids, redacted
  arguments, the before state (for mutations on a task, case, plan, document or sprint), the
  after state, and the outcome.

## Connecting a client

- **Claude Code:**
  `claude mcp add --transport http taskflow https://<taskflow>/api/mcp --header "Authorization: Bearer <token>"`
- **Other MCP clients (JSON config):**
  `{ "mcpServers": { "taskflow": { "url": "https://<taskflow>/api/mcp", "headers": { "Authorization": "Bearer <token>" } } } }`
- **UTCP:** add a manual call template
  `{ "name": "taskflow", "call_template_type": "http", "url": "https://<taskflow>/api/utcp", "http_method": "GET", "auth": { "auth_type": "api_key", "api_key": "Bearer ${TASKFLOW_TOKEN}", "var_name": "Authorization", "location": "header" } }`
  and set `TASKFLOW_TOKEN`.

Browser origins other than TaskFlow's own are refused, as DNS-rebinding protection. Non-browser
clients send no `Origin`.
