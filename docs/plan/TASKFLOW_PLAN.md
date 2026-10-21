# TaskFlow build plan

TaskFlow is an original work-management app: tasks, sprints, documents and HR in one workspace. It's built from common patterns in this product category, in our own visual style. No third-party code, assets, icons, copy or brand are reused (see `docs/research/log.md`).

## Product scope

| Area | What users can do |
|------|-------------------|
| Workspaces | Create a workspace, invite members, assign roles |
| Hierarchy | Workspace → Space → List → Task, shown as a sidebar tree |
| Tasks | Title, rich description, status, priority, assignee, due date, sprint, comments. List view grouped by status, board view with drag between columns |
| Sprints | Sprints per space with goal, start and end dates. Plan backlog into a sprint, start it, complete it (unfinished tasks roll back to the backlog or into the next sprint) |
| Documents | Workspace docs organised in a page tree, optionally linked to a space. Markdown content, sanitised on the server |
| HR | Departments, employee profiles (job title, manager, start date), leave types, leave requests with an approval flow, and leave balances |
| Roles | Built-in workspace roles (Owner, Admin, Member, Guest) plus **custom roles** built from a permission list |
| Platform admin | `SUPER_ADMIN` sees every workspace and user, can suspend users, and reads the audit log |

## Roles and permissions

There are two layers. Both are checked on the server on every request.

1. **Platform role**, stored on the user: `SUPER_ADMIN` or `USER`. It's set only by the `SUPER_ADMIN_EMAILS` env bootstrap or by another super admin, never by the request body. Super admin actions are audit-logged.
2. **Workspace role**, stored on the membership: a role row that holds a set of permission keys. System roles are seeded per workspace and can't be deleted. Custom roles are created by anyone with `roles.manage`.

Permission keys live in `@taskflow/shared-types` so the API guard and the UI read the same list:

```
workspace.manage   members.manage   roles.manage
space.manage       list.manage
task.view  task.create  task.update  task.delete  task.assign
sprint.manage
doc.view   doc.create   doc.manage
hr.view    hr.manage    leave.request  leave.approve
audit.view
```

The API uses `@RequirePermissions(...)` plus a `WorkspaceAccessGuard`. The guard loads the caller's membership from `(workspaceId, userId)`, and every query is scoped by `workspace_id`, which blocks IDOR.

## Architecture

The file-by-file layout and SOLID rules are in [`docs/architecture/FOLDER_STRUCTURE.md`](../architecture/FOLDER_STRUCTURE.md). Summary:

```
apps/
  api/          NestJS + TypeORM + Better Auth, one module per feature
  web/          React + Vite + TanStack Router/Query + Zustand + shadcn/ui
packages/
  shared-types/ domain constants, permission keys, request/response contracts
  sdk/          typed client generated from the API's OpenAPI (Swagger) file
infra/
  docker/       docker-compose for postgres, api and web
  terraform/    the same local stack described with the Docker provider
```

- **Backend modules** (NestJS style): `auth`, `users`, `workspaces`, `members`, `roles`, `spaces`, `lists`, `tasks`, `comments`, `sprints`, `documents`, `hr`, `audit`, `admin`, `health`. Each module has four layers: `presentation` (controller, DTOs) → `application` (service, mapper) → `domain` (types, repository port, policies) ← `infrastructure` (TypeORM entity and repository adapter).
- **Frontend modules** mirror the backend: `src/modules/<feature>/{api,hooks,components,pages,store}`. Shared UI lives in `src/components/ui` (shadcn) and `src/components/common`.
- **SOLID:** controllers only handle HTTP, services hold the business rules, repositories handle persistence. Permission checks live in one place (guard + `AccessService`). Features depend on interfaces such as `AuditLogger` and `Clock` instead of on concrete classes.
- **SDK flow:** `pnpm sdk:generate` → API writes `packages/sdk/openapi.json` → `openapi-typescript` generates `schema.d.ts` → `openapi-fetch` client used by the web app.

## Security baseline (from AGENTS.md)

- Better Auth email and password with a CAPTCHA plugin (Turnstile) on signup, login and reset. Secure `HttpOnly` `SameSite` cookies, sessions rotated and revoked.
- Global session guard; public routes are opt-in with `@Public()` plus a reason comment.
- `class-validator` whitelist plus `forbidNonWhitelisted` on every DTO, so fields are allowlisted (no mass assignment).
- `@nestjs/throttler` on all routes, with tighter limits on auth.
- helmet (CSP, HSTS, nosniff, frame-ancestors, Referrer-Policy), CORS from `CORS_ORIGINS`, generic error filter in production.
- Append-only `audit_log` for admin, role and HR actions.
- Max page size 100; body size limit.
- Postgres RLS on tenant tables is a follow-up (phase 7). Until then, tenant isolation is enforced in the repository layer.

## Phases

| # | Phase | Deliverable |
|---|-------|-------------|
| 0 | Foundation | pnpm monorepo, shared types, tsconfig, lint |
| 1 | API core | Better Auth, session guard, workspaces, members, roles/permissions, spaces, lists, tasks, audit log, Swagger + SDK |
| 2 | Web shell | Auth pages, app layout with sidebar tree, list and board views, task detail drawer |
| 3 | Sprints | Sprint CRUD, backlog planning, start/complete flow, sprint board |
| 4 | Documents | Page tree, markdown editor with sanitised preview |
| 5 | HR | Departments, employee profiles, leave types, leave requests and approvals, balances |
| 6 | Platform admin | Super admin console for users, workspaces and the audit log |
| 7 | Hardening | Postgres RLS, CAPTCHA wiring end to end, `/security-review`, e2e tests |
| 8 | Infra | docker-compose and Terraform for the full stack, seed data, README |

Infra files are added in phase 1 so the stack runs from the start. Phase 8 polishes them.
