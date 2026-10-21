# TaskFlow folder structure and SOLID rules

This is the target layout for the whole monorepo, down to file names. Every new file goes where this document says. If something doesn't fit, update this document in the same PR.

Legend: ✅ exists today · 🔜 planned (phase in brackets)

---

## 1. Repository root

```
TaskTracker/
├── AGENTS.md                         ✅ rules for every AI agent (security, OWASP, REA, gstack)
├── CLAUDE.md                         ✅ points to AGENTS.md
├── README.MD                         🔜 [8] quick start, scripts, architecture links
├── .env.example                      ✅ every env var name, no values
├── .gitignore                        ✅
├── .nvmrc                            ✅ Node 22
├── package.json                      ✅ root scripts only (build, typecheck, test, sdk:generate, infra:*)
├── pnpm-workspace.yaml               ✅ apps/* and packages/*
├── pnpm-lock.yaml                    ✅ committed lockfile (AGENTS.md rule 15)
├── tsconfig.base.json                ✅ strict TS settings every package extends
├── eslint.config.js                  🔜 [7] shared lint rules, including import boundaries (section 7)
├── .github/
│   └── workflows/
│       └── ci.yml                    🔜 [7] install from lockfile, typecheck, test, audit (actions pinned to SHA)
├── .claude/
│   └── skills/saas-security-audit/   ✅
├── apps/
│   ├── api/                          ✅ NestJS backend (section 2)
│   └── web/                          🔜 [2] React frontend (section 3)
├── packages/
│   ├── shared-types/                 ✅ contracts shared by api and web (section 4)
│   └── sdk/                          ✅ typed client generated from OpenAPI (section 5)
├── infra/
│   ├── docker/                       🔜 [1-8] docker compose for the local stack (section 6)
│   └── terraform/                    🔜 [1-8] the same stack via the Docker provider (section 6)
├── scripts/
│   └── rea-browser.sh                ✅
└── docs/
    ├── architecture/FOLDER_STRUCTURE.md  ✅ this file
    ├── plan/TASKFLOW_PLAN.md         ✅ phases and scope
    └── research/                     ✅ REA protocol and log
```

Each app and package has its own `package.json`, `tsconfig.json` and (for apps) `Dockerfile`, so any of them can move to its own repo later without changes.

---

## 2. Backend: `apps/api`

### 2.1 Top level

```
apps/api/
├── package.json
├── tsconfig.json                     editor and typecheck config (includes specs)
├── tsconfig.build.json               build config (excludes specs)
├── vitest.config.ts                  🔜 [7]
├── Dockerfile                        🔜 [1] multi-stage build, runs as non-root
├── test/
│   └── e2e/                          🔜 [7] one *.e2e-spec.ts per module, real Postgres
└── src/
    ├── main.ts                       starts the app; delegates every concern to bootstrap/*
    ├── app.module.ts                 imports core and feature modules, registers global guards
    ├── bootstrap/                    one file per startup concern (SRP)
    ├── config/                       env schema and config module
    ├── core/                         cross-cutting building blocks used by every module
    ├── modules/                      one folder per business feature
    ├── cli/                          operator scripts (migrations, OpenAPI export, promote admin)
    └── openapi/                      Swagger document builder
```

### 2.2 `bootstrap/`, `config/`, `cli/`, `openapi/`

```
src/bootstrap/
├── api-prefix.ts                     the global `/api` prefix, shared with the OpenAPI export
├── security.bootstrap.ts             helmet (CSP, HSTS, frame-ancestors, referrer, permissions policy), CORS
├── body-parsers.bootstrap.ts         JSON and urlencoded parsers with size limits
├── auth-routes.bootstrap.ts          mounts the Better Auth handler before the body parsers
├── validation.bootstrap.ts           global ValidationPipe (whitelist, forbidNonWhitelisted)
└── swagger.bootstrap.ts              serves /api/docs outside production only

src/config/
├── env.schema.ts                     zod schema; fails fast on bad config
└── config.module.ts                  provides the ENV token

src/cli/
├── run-migrations.ts                 Better Auth migrations, then TypeORM migrations
├── export-openapi.ts                 writes packages/sdk/openapi.json without a database
└── promote-super-admin.ts            🔜 [6] operator-only: grants SUPER_ADMIN by email, writes an audit entry

src/openapi/
└── openapi.document.ts               DocumentBuilder setup and operationId naming
```

### 2.3 `core/`

Core code knows nothing about tasks, sprints or HR. Feature modules depend on core, never the other way around. When core needs feature data, it defines a port and `app.module.ts` binds a feature adapter to it (see `membership-reader.port.ts`). The one exception is `orm-entities.ts`, because TypeORM needs every entity at startup.

```
src/core/
├── domain/
│   └── domain-error.ts               DomainError (not_found | forbidden | invalid | conflict); no HTTP details
├── auth/
│   ├── auth.module.ts
│   ├── better-auth.factory.ts        builds the Better Auth instance (plugins, rate limits, cookies)
│   ├── auth.service.ts               turns request headers into a SessionUser
│   ├── session.guard.ts              global guard: valid session or 401 (fails closed)
│   └── mailer/
│       ├── mailer.port.ts            abstract class Mailer { sendPasswordReset(...) }
│       ├── console.mailer.ts         development adapter (prints links in dev only)
│       └── smtp.mailer.ts            🔜 [7] production adapter
├── access/
│   ├── access.module.ts              AccessModule.forRoot({ membershipReader }) — the adapter is injected
│   ├── membership-reader.port.ts     abstract class MembershipReader { findGrant, workspaceExists }
│   ├── access.service.ts             resolves (user, workspace) → role + permissions
│   ├── workspace-access.guard.ts     checks membership and permissions for :workspaceId routes
│   ├── platform-admin.guard.ts       🔜 [6] SUPER_ADMIN-only routes
│   ├── require-permissions.decorator.ts
│   └── current-access.decorator.ts
├── audit/
│   ├── audit.module.ts
│   ├── audit-logger.port.ts          abstract class AuditLogger { record(actor, entry) }
│   ├── typeorm-audit-logger.ts       adapter writing to audit_log
│   └── audit-log.orm-entity.ts
├── database/
│   ├── database.module.ts            TypeORM root config; provides UnitOfWork, TransactionalManager, health
│   ├── data-source-options.ts
│   ├── snake-naming.strategy.ts
│   ├── base.orm-entity.ts            BaseOrmEntity, TenantOrmEntity (workspaceId)
│   ├── orm-entities.ts               single list of every ORM entity
│   ├── pg-pool.provider.ts           pg pool for Better Auth
│   ├── unit-of-work.port.ts          abstract class UnitOfWork { run(work) }
│   ├── typeorm-unit-of-work.ts       adapter; nested calls join the outer transaction
│   ├── transactional-manager.ts      gives repositories the current transaction's EntityManager (AsyncLocalStorage)
│   ├── database-health.indicator.ts  SELECT 1 for /health
│   └── migrations/
│       ├── index.ts                  ordered list of migrations
│       └── <timestamp>-<name>.ts     one file per migration, never edited after merge
├── storage/                          🔜 [4] document attachments and HR files
│   ├── storage.port.ts               abstract class FileStorage { put, signedUrl, delete }
│   ├── s3.storage.ts                 adapter (MinIO locally), private bucket, short-lived URLs
│   └── file-type.validator.ts        magic-byte check, size limit, blocks HTML/SVG
└── http/
    ├── types/authenticated-request.ts    SessionUser, WorkspaceAccess, Actor
    ├── decorators/
    │   ├── public.decorator.ts
    │   ├── current-actor.decorator.ts
    │   └── current-user.decorator.ts
    ├── filters/all-exceptions.filter.ts  generic client errors, details to logs
    ├── guards/user-throttler.guard.ts    rate limit by user, falling back to IP
    ├── pipes/uuid.pipe.ts
    ├── dto/page-query.dto.ts         shared page/pageSize validation (max 100) and toPageRequest()
    └── utils/escape-like.ts
```

### 2.4 Feature module template

Every feature module uses the same four layers. Dependencies only point inward: `presentation → application → domain ← infrastructure`.

```
src/modules/<feature>/
├── <feature>.module.ts               wiring only: binds each port to its adapter
├── domain/                           plain TypeScript, no Nest or TypeORM imports
│   ├── <entity>.ts                   interface <Entity> (the shape services work with)
│   ├── <entity>.repository.ts        abstract class <Entity>Repository (the port)
│   └── <rule>.policy.ts              one business rule as a pure function or class
├── application/
│   ├── <feature>.service.ts          use cases; depends on domain ports only
│   └── <entity>.mapper.ts            domain object → response DTO
├── infrastructure/
│   ├── <entity>.orm-entity.ts        TypeORM entity that implements the domain interface
│   └── typeorm-<entity>.repository.ts    adapter implementing the port; always filters by workspaceId
├── testing/
│   └── in-memory-<entity>.repository.ts  fake that honours the port's contract, for service specs
└── presentation/
    ├── <feature>.controller.ts       HTTP only: route, guards, params, call the service
    └── dto/
        ├── create-<entity>.dto.ts    class-validator + Swagger, implements the shared request type
        ├── update-<entity>.dto.ts
        ├── <entity>-query.dto.ts     list filters and paging
        └── <entity>.response.dto.ts  Swagger schema, implements the shared response type
```

Tests sit next to the code they test: `application/<feature>.service.spec.ts` (using the fake from `testing/`) and `domain/<rule>.policy.spec.ts`. Services and policies throw `DomainError`, never Nest HTTP exceptions; `AllExceptionsFilter` turns the error kind into a status code.

### 2.5 Feature modules, file by file

```
src/modules/
├── health/                                       ✅
│   ├── health.module.ts
│   └── presentation/
│       ├── health.controller.ts                  @Public, used by container health checks
│       └── dto/health.response.dto.ts
│
├── users/                                        ✅
│   ├── users.module.ts
│   ├── domain/user.ts                            id, name, email, platformRole, suspended
│   ├── domain/user.repository.ts                 findByEmail, findById
│   ├── infrastructure/user.orm-entity.ts         read model over Better Auth's "user" table
│   ├── infrastructure/typeorm-user.repository.ts
│   └── presentation/
│       ├── me.controller.ts                      GET /me
│       └── dto/current-user.response.dto.ts
│
├── workspaces/                                   ✅
│   ├── workspaces.module.ts
│   ├── domain/workspace.ts
│   ├── domain/workspace.repository.ts
│   ├── application/workspaces.service.ts         create (seeds roles + owner in one transaction), update, delete
│   ├── application/workspace.mapper.ts
│   ├── infrastructure/workspace.orm-entity.ts
│   ├── infrastructure/typeorm-workspace.repository.ts
│   └── presentation/
│       ├── workspaces.controller.ts
│       └── dto/{create-workspace,update-workspace,workspace.response}.dto.ts
│
├── roles/                                        ✅
│   ├── roles.module.ts
│   ├── domain/workspace-role.ts
│   ├── domain/workspace-role.repository.ts
│   ├── domain/system-roles.ts                    built-in roles seeded per workspace
│   ├── domain/role-grant.policy.ts               no granting permissions you don't hold; owner-only permission
│   ├── application/roles.service.ts
│   ├── application/role.mapper.ts
│   ├── infrastructure/workspace-role.orm-entity.ts
│   ├── infrastructure/typeorm-workspace-role.repository.ts
│   └── presentation/
│       ├── roles.controller.ts
│       └── dto/{create-role,update-role,role.response}.dto.ts
│
├── members/                                      ✅
│   ├── members.module.ts
│   ├── domain/workspace-member.ts                plus MembershipWithRole and MemberDetails read models
│   ├── domain/workspace-member.repository.ts
│   ├── domain/owner-guard.policy.ts              a workspace always keeps one owner
│   ├── application/members.service.ts            add (no user enumeration), change role, remove, leave
│   ├── application/member.mapper.ts
│   ├── infrastructure/workspace-member.orm-entity.ts
│   ├── infrastructure/typeorm-workspace-member.repository.ts   joins roles and users by table name
│   ├── infrastructure/typeorm-membership.reader.ts             adapter for core's MembershipReader port
│   └── presentation/
│       ├── members.controller.ts
│       └── dto/{add-member,update-member-role,member.response,add-member-result.response}.dto.ts
│
├── spaces/                                       ✅  (same layout: space.ts, space.repository.ts, spaces.service.ts, …)
├── lists/                                        ✅  (task-list.ts, task-list.repository.ts, lists.service.ts, …)
│
├── tasks/                                        ✅
│   ├── tasks.module.ts
│   ├── domain/task.ts
│   ├── domain/task.repository.ts                 findInWorkspace, pageInList, nextPosition, save, delete
│   ├── domain/task-assignment.policy.ts          needs task.assign; assignee must be a member
│   ├── application/tasks.service.ts
│   ├── application/task.mapper.ts
│   ├── infrastructure/task.orm-entity.ts
│   ├── infrastructure/typeorm-task.repository.ts
│   ├── testing/in-memory-task.repository.ts
│   └── presentation/
│       ├── tasks.controller.ts
│       └── dto/{create-task,update-task,task-query,task.response,task-page.response}.dto.ts
│
├── comments/                                     🔜 [2]
│   ├── domain/{comment.ts,comment.repository.ts}
│   ├── application/{comments.service.ts,comment.mapper.ts}
│   ├── infrastructure/{comment.orm-entity.ts,typeorm-comment.repository.ts}
│   └── presentation/{comments.controller.ts,dto/…}
│
├── sprints/                                      🔜 [3]
│   ├── sprints.module.ts
│   ├── domain/sprint.ts                          name, goal, startDate, endDate, status
│   ├── domain/sprint.repository.ts
│   ├── domain/sprint-lifecycle.policy.ts         planned → active → completed; one active sprint per space
│   ├── domain/sprint-rollover.policy.ts          where unfinished tasks go on completion
│   ├── application/sprints.service.ts            create, plan tasks, start, complete (one transaction)
│   ├── application/sprint.mapper.ts
│   ├── infrastructure/sprint.orm-entity.ts
│   ├── infrastructure/typeorm-sprint.repository.ts
│   └── presentation/
│       ├── sprints.controller.ts
│       └── dto/{create-sprint,update-sprint,complete-sprint,sprint.response}.dto.ts
│
├── documents/                                    🔜 [4]
│   ├── documents.module.ts
│   ├── domain/document.ts                        page tree via parentId, optional spaceId
│   ├── domain/document.repository.ts
│   ├── domain/content-sanitizer.port.ts          abstract class ContentSanitizer
│   ├── domain/document-tree.policy.ts            blocks cycles and limits nesting depth
│   ├── application/documents.service.ts
│   ├── application/document.mapper.ts
│   ├── infrastructure/document.orm-entity.ts
│   ├── infrastructure/typeorm-document.repository.ts
│   ├── infrastructure/markdown.sanitizer.ts      adapter for ContentSanitizer
│   └── presentation/
│       ├── documents.controller.ts
│       ├── document-attachments.controller.ts    uses core/storage
│       └── dto/{create-document,update-document,move-document,document.response,document-tree.response}.dto.ts
│
├── hr/                                           🔜 [5] one parent module, three sub-features
│   ├── hr.module.ts
│   ├── departments/
│   │   ├── domain/{department.ts,department.repository.ts}
│   │   ├── application/{departments.service.ts,department.mapper.ts}
│   │   ├── infrastructure/{department.orm-entity.ts,typeorm-department.repository.ts}
│   │   └── presentation/{departments.controller.ts,dto/…}
│   ├── employees/
│   │   ├── domain/{employee-profile.ts,employee-profile.repository.ts,reporting-line.policy.ts}
│   │   ├── application/{employees.service.ts,employee-profile.mapper.ts}
│   │   ├── infrastructure/{employee-profile.orm-entity.ts,typeorm-employee-profile.repository.ts}
│   │   └── presentation/{employees.controller.ts,dto/…}
│   └── leave/
│       ├── domain/leave-type.ts
│       ├── domain/leave-request.ts               pending → approved | rejected | cancelled
│       ├── domain/leave-balance.ts
│       ├── domain/leave.repository.ts
│       ├── domain/leave-approval.policy.ts       approver needs leave.approve and can't approve their own request
│       ├── domain/leave-days.calculator.ts       working days between dates
│       ├── application/leave.service.ts          request, approve and reject; balance changes under a row lock
│       ├── application/leave.mapper.ts
│       ├── infrastructure/{leave-type,leave-request,leave-balance}.orm-entity.ts
│       ├── infrastructure/typeorm-leave.repository.ts
│       └── presentation/
│           ├── leave-types.controller.ts
│           ├── leave-requests.controller.ts
│           └── dto/…
│
└── admin/                                        🔜 [6] SUPER_ADMIN only
    ├── admin.module.ts
    ├── application/{admin-users.service.ts,admin-workspaces.service.ts,admin-audit.service.ts}
    └── presentation/
        ├── admin-users.controller.ts             list, suspend, promote (audited)
        ├── admin-workspaces.controller.ts
        ├── admin-audit.controller.ts             paged audit log
        └── dto/…
```

---

## 3. Frontend: `apps/web` 🔜 [2]

The frontend mirrors the backend: one folder per feature, and the same direction of dependencies.

### 3.1 Top level

```
apps/web/
├── package.json
├── tsconfig.json
├── vite.config.ts                    React plugin, Tailwind, dev proxy for /api
├── components.json                   shadcn/ui config
├── index.html
├── Dockerfile                        build with Vite, serve with nginx as non-root
├── nginx.conf                        SPA fallback, security headers, no server tokens
└── src/
    ├── main.tsx                      mounts <App />
    ├── app/                          composition root
    ├── core/                         cross-cutting: api client, auth, permissions, config
    ├── components/                   reusable UI with no feature knowledge
    ├── modules/                      one folder per feature
    ├── lib/                          small pure helpers
    └── styles/globals.css            Tailwind layers and TaskFlow design tokens
```

### 3.2 `app/`, `core/`, `components/`, `lib/`

```
src/app/
├── app.tsx                           <Providers><RouterProvider/></Providers>
├── providers.tsx                     QueryClientProvider, ThemeProvider, Toaster
├── router.tsx                        builds the route tree from each module's routes.tsx
└── query-client.ts                   retries, stale times, 401 → sign-in

src/core/
├── config/env.ts                     reads and validates VITE_* values
├── api/sdk-client.ts                 single createTaskFlowClient() instance
├── auth/
│   ├── auth-client.ts                Better Auth React client
│   ├── use-session.ts
│   ├── require-auth.tsx              route guard component
│   └── turnstile-widget.tsx          CAPTCHA widget for public forms
└── permissions/
    ├── use-permissions.ts            reads permissions from the current workspace
    └── can.tsx                       <Can permission="task.delete">…</Can> (UI only; the server still checks)

src/components/
├── ui/                               shadcn primitives, restyled with TaskFlow tokens
│   ├── button.tsx  input.tsx  textarea.tsx  label.tsx  select.tsx  checkbox.tsx
│   ├── dialog.tsx  sheet.tsx  dropdown-menu.tsx  popover.tsx  tooltip.tsx
│   ├── badge.tsx  avatar.tsx  card.tsx  separator.tsx  skeleton.tsx  tabs.tsx
│   ├── table.tsx  calendar.tsx  sonner.tsx
│   └── form.tsx                      react-hook-form + zod bindings
├── common/                           built from ui/, still feature-agnostic
│   ├── page-header.tsx
│   ├── empty-state.tsx
│   ├── confirm-dialog.tsx
│   ├── data-table.tsx                TanStack Table wrapper with paging
│   ├── color-picker.tsx
│   ├── user-avatar.tsx
│   ├── date-picker.tsx
│   └── error-boundary.tsx
└── layout/
    ├── app-shell.tsx                 sidebar + topbar + <Outlet/>
    ├── sidebar.tsx                   composes the workspace switcher and nav sections
    ├── sidebar-section.tsx
    └── topbar.tsx

src/lib/
├── cn.ts                             clsx + tailwind-merge
├── dates.ts
└── query-keys.ts                     one factory for every TanStack Query key
```

### 3.3 Feature module template

```
src/modules/<feature>/
├── index.ts                          public surface: routes and any components other modules may use
├── routes.tsx                        TanStack Router route definitions for this feature
├── api/<feature>.api.ts              thin calls to @taskflow/sdk (the only place that touches the client)
├── hooks/
│   ├── use-<entities>.ts             TanStack Query read hooks
│   └── use-<entity>-mutations.ts     create, update and delete with cache updates
├── store/<feature>.store.ts          Zustand, UI state only (view mode, open panel, filters)
├── components/                       presentational; data comes in through props
│   └── <feature>-*.tsx
└── pages/
    └── <feature>-*.page.tsx          containers: call hooks, pass data to components
```

### 3.4 Feature modules

```
src/modules/
├── auth/            pages/{sign-in,sign-up,forgot-password,reset-password}.page.tsx, components/auth-form-card.tsx
├── workspaces/      pages/{workspace-home,workspace-settings}.page.tsx, components/{workspace-switcher,create-workspace-dialog}.tsx
├── members/         pages/members.page.tsx, components/{member-table,add-member-dialog,role-select}.tsx
├── roles/           pages/roles.page.tsx, components/{role-list,role-editor,permission-matrix}.tsx
├── spaces/          components/{space-tree,space-tree-item,create-space-dialog}.tsx
├── lists/           pages/list.page.tsx, components/{list-header,view-switcher}.tsx
├── tasks/           components/
│                      list-view/{task-list-view,task-group,task-row}.tsx
│                      board-view/{task-board-view,board-column,task-card}.tsx
│                      detail/{task-detail-sheet,task-fields,task-description}.tsx
│                      shared/{status-badge,priority-flag,assignee-picker,due-date-picker,quick-add-task}.tsx
├── comments/        components/{comment-thread,comment-composer}.tsx
├── sprints/         pages/{sprints,sprint-board}.page.tsx, components/{sprint-card,backlog-panel,start-sprint-dialog,complete-sprint-dialog}.tsx
├── documents/       pages/document.page.tsx, components/{doc-tree,doc-editor,markdown-preview}.tsx
├── hr/              pages/{directory,departments,leave,leave-approvals}.page.tsx
│                    components/{employee-card,department-form,leave-request-form,leave-balance-card,approval-queue}.tsx
└── admin/           pages/{admin-users,admin-workspaces,admin-audit}.page.tsx
```

Each module above also has its own `index.ts`, `routes.tsx`, `api/`, `hooks/` and `store/` as in the template.

---

## 4. `packages/shared-types`

Types and constants only, with no runtime dependencies. Both apps import from here, so a contract change breaks the build on both sides.

```
packages/shared-types/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                      re-exports everything
    ├── domain/                       values with meaning across the stack
    │   ├── permissions.ts            ✅ PERMISSIONS, PLATFORM_ROLES, SYSTEM_ROLE_PERMISSIONS
    │   ├── workspace.ts              ✅ NAME_MAX, COLOR_PATTERN
    │   ├── task.ts                   ✅ TASK_STATUSES, TASK_PRIORITIES, limits
    │   ├── pagination.ts             ✅ PAGE_SIZE_MAX, Paginated<T>
    │   ├── sprint.ts                 🔜 [3] SPRINT_STATUSES
    │   ├── document.ts               🔜 [4] limits
    │   └── hr.ts                     🔜 [5] LEAVE_STATUSES, EMPLOYMENT_TYPES
    └── contracts/                    request and response shapes, one file per feature
        ├── user.contract.ts          ✅
        ├── workspace.contract.ts     ✅
        ├── member.contract.ts        ✅
        ├── role.contract.ts          ✅
        ├── space.contract.ts         ✅
        ├── list.contract.ts          ✅
        ├── task.contract.ts          ✅
        ├── comment.contract.ts       🔜 [2]
        ├── sprint.contract.ts        🔜 [3]
        ├── document.contract.ts      🔜 [4]
        ├── hr.contract.ts            🔜 [5]
        └── admin.contract.ts         🔜 [6]
```

## 5. `packages/sdk`

```
packages/sdk/
├── package.json
├── tsconfig.json
├── openapi.json                      ✅ written by `pnpm --filter @taskflow/api openapi:export`
└── src/
    ├── index.ts                      ✅
    ├── client.ts                     ✅ createTaskFlowClient, unwrap, ApiError
    └── generated/schema.ts           ✅ written by openapi-typescript; never edit by hand
```

Flow: API DTO classes → `openapi.json` → `schema.ts` → web `*.api.ts`. Run `pnpm sdk:generate` after any API change, and commit all three generated outputs.

---

## 6. `infra`

```
infra/
├── docker/
│   ├── docker-compose.yml            postgres, migrate (one-off), api, web; private network; only web and api ports exposed on localhost
│   └── postgres/
│       └── init.sql                  creates the app role without superuser rights
└── terraform/                        the same local stack, via the kreuzwerker/docker provider
    ├── versions.tf                   pinned provider versions
    ├── providers.tf
    ├── variables.tf                  secrets marked sensitive, no defaults
    ├── network.tf
    ├── postgres.tf                   container + named volume
    ├── api.tf                        image built from apps/api/Dockerfile
    ├── web.tf                        image built from apps/web/Dockerfile
    ├── outputs.tf                    URLs only, never secrets
    ├── terraform.tfvars.example
    └── README.md
```

---

## 7. SOLID rules and where they live

| Principle | Rule in this repo | Example |
|-----------|-------------------|---------|
| **S**ingle responsibility | One reason to change per file. Controllers handle HTTP, services hold use cases, repositories handle persistence, mappers shape responses, policies hold one business rule, guards make one check. `main.ts` only calls `bootstrap/*`. Aim for files under ~200 lines. | `role-grant.policy.ts` holds the anti-escalation rule, and both `roles.service.ts` and `members.service.ts` use it. |
| **O**pen/closed | Extend by adding, not editing. New permissions and roles are data. New providers (mail, storage, CAPTCHA, sanitizer) are new adapters behind an existing port. New features are new modules. | Switching `ConsoleMailer` to `SmtpMailer` changes one line in `auth.module.ts`. |
| **L**iskov substitution | Every adapter honours its port's contract: the same nulls, errors and ordering. Test fakes must behave like the real adapter. | `TaskRepository.findInWorkspace` returns `null` when not found in both `TypeOrmTaskRepository` and the in-memory fake. |
| **I**nterface segregation | Ports stay small and feature-specific; no generic `BaseRepository<T>` with dozens of methods. React components take only the props they render. | `TaskRepository` exposes the five methods `TasksService` needs; `<TaskCard>` takes a `task` and an `onOpen`. |
| **D**ependency inversion | Services depend on abstract classes in `domain/` (Nest uses them as DI tokens); modules bind them to adapters. On the web, pages depend on hooks, hooks on `*.api.ts`, and only `*.api.ts` touches the SDK. | `{ provide: TaskRepository, useClass: TypeOrmTaskRepository }` in `tasks.module.ts`. |

### Import boundaries (enforced by ESLint in phase 7)

| From | May import | Must not import |
|------|------------|-----------------|
| `modules/*/domain` | `@taskflow/shared-types`, `core/domain`, other files in `domain/` | Nest, TypeORM, `infrastructure/`, `presentation/` |
| `modules/*/application` | own `domain/`, `core/*` ports, other modules' exported services and domain policies | `infrastructure/`, TypeORM `Repository` |
| `modules/*/infrastructure` | own `domain/`, TypeORM, `core/database` | `presentation/` |
| `modules/*/presentation` | own `application/`, `core/access`, `core/http` | `infrastructure/` |
| `core/*` | other `core/*`, `config/` | `modules/*` (`core/access` may read member and role ORM entities) |
| web `components/*` | `lib/`, other `components/*` | `modules/*`, `core/api` |
| web `modules/<a>` | `components/`, `core/`, `lib/`, `modules/<b>/index.ts` | another module's internal files |

### Naming

- File names are kebab-case and end with their role: `.module.ts`, `.controller.ts`, `.service.ts`, `.repository.ts` (port), `typeorm-*.repository.ts` (adapter), `.orm-entity.ts`, `.policy.ts`, `.mapper.ts`, `.dto.ts`, `.port.ts`, `.spec.ts`. On the web: `.api.ts`, `use-*.ts`, `.store.ts`, `.page.tsx`.
- Classes are PascalCase and match the file: `typeorm-task.repository.ts` → `TypeOrmTaskRepository`.
- Ports are abstract classes, not TypeScript interfaces, because Nest needs a runtime token.
