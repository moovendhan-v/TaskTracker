# TaskFlow folder structure and SOLID rules

This is the target layout for the whole monorepo, down to file names. Every new file goes where this document says. If something doesn't fit, update this document in the same PR.

Legend: ✅ exists today · 🔜 planned (phase in brackets)

---

## 1. Repository root

```
TaskTracker/
├── AGENTS.md                         ✅ rules for every AI agent (security, OWASP, REA, gstack)
├── CLAUDE.md                         ✅ points to AGENTS.md
├── README.md                         ✅ quick start, scripts, testing, security overview
├── .env.example                      ✅ every env var name, no values
├── .gitignore                        ✅
├── .dockerignore                     ✅ keeps node_modules, build output and .env files out of image builds
├── .nvmrc                            ✅ Node 22
├── package.json                      ✅ root scripts only (build, lint, typecheck, test, test:e2e, sdk:generate, db:up, infra:*)
├── pnpm-workspace.yaml               ✅ apps/* and packages/*, plus security overrides with a reason each
├── pnpm-lock.yaml                    ✅ committed lockfile (AGENTS.md rule 15)
├── tsconfig.base.json                ✅ strict TS settings every package extends
├── eslint.config.js                  ✅ shared lint rules, including the import boundaries in section 7
├── .github/
│   ├── dependabot.yml                ✅ weekly updates for actions and npm packages
│   └── workflows/
│       └── ci.yml                    ✅ lockfile install, audit, SDK drift check, lint, typecheck, tests, e2e (actions pinned to SHA)
├── .claude/
│   └── skills/saas-security-audit/   ✅
├── apps/
│   ├── api/                          ✅ NestJS backend (section 2)
│   └── web/                          ✅ React frontend (section 3)
├── packages/
│   ├── shared-types/                 ✅ contracts shared by api and web (section 4)
│   └── sdk/                          ✅ typed GraphQL operations and client generated from the schema (section 5)
├── infra/
│   ├── docker/                       ✅ docker compose for the local stack (section 6)
│   └── terraform/                    ✅ the same stack via the Docker provider (section 6)
├── scripts/
│   ├── rea-browser.sh                ✅
│   ├── dev.sh                        ✅ one-command dev stack in Docker (creates .env, picks free ports, up/down)
│   └── create-e2e-database.sh        ✅ throwaway taskflow_test database in local Docker Postgres; writes .env.e2e
└── docs/
    ├── architecture/FOLDER_STRUCTURE.md  ✅ this file
    ├── plan/TASKFLOW_PLAN.md         ✅ phases and scope
    ├── research/                     ✅ REA protocol and log
    └── screenshots/                  ✅ UI screenshots
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
├── vitest.config.ts                  ✅ unit tests (src/**/*.spec.ts)
├── vitest.e2e.config.ts              ✅ end-to-end tests (test/e2e)
├── Dockerfile                        ✅ multi-stage build, runs as non-root
├── test/
│   ├── tsconfig.json
│   └── e2e/                          ✅ black box: migrates a *test* database, starts dist/main.js, talks GraphQL over HTTP
│       ├── support/                  global setup (API + SMTP catcher), cookie-keeping TestUser, fixtures, mailbox, DB access
│       └── *.e2e-spec.ts             tenancy, password reset, tasks and sprints, docs and HR, roles and admin, IAM policies,
│                                     space access and hierarchy, templates, automations, GitHub, GraphQL hardening, RLS, …
└── src/
    ├── main.ts                       starts the app; delegates every concern to bootstrap/*
    ├── app.module.ts                 imports core and feature modules; registers global guards, interceptor and filter
    ├── bootstrap/                    one file per startup concern (SRP)
    ├── config/                       env schema and config module
    ├── core/                         cross-cutting building blocks used by every module
    ├── modules/                      one folder per business feature
    ├── graphql-resolvers.ts          single list of every GraphQL resolver (app and schema export share it)
    └── cli/                          operator scripts (migrations, schema export, promote admin, demo seed)
```

The API is GraphQL only (`/api/graphql`). The only other HTTP routes are Better Auth's handler (`/api/auth/*`), the `/api/health` liveness probe and the signed GitHub webhook (`/api/integrations/github/webhook/:id`).

### 2.2 `bootstrap/`, `config/`, `cli/`

```
src/bootstrap/
├── api-prefix.ts                     the global `/api` prefix
├── security.bootstrap.ts             helmet (CSP, HSTS, frame-ancestors, referrer, permissions policy), CORS
├── body-parsers.bootstrap.ts         JSON parser with a size limit (GraphQL takes JSON only)
├── auth-routes.bootstrap.ts          mounts the Better Auth handler before the body parsers
├── webhook-routes.bootstrap.ts       raw, size-limited JSON body for /api/integrations/* (signatures cover the exact bytes)
├── validation.bootstrap.ts           global ValidationPipe (whitelist, forbidNonWhitelisted)
└── websocket.bootstrap.ts            closes WebSocket upgrades on any path but /api/graphql

src/config/
├── env.schema.ts                     zod schema; fails fast on bad config (CAPTCHA secret required in production)
├── env.schema.spec.ts
└── config.module.ts                  provides the ENV token

src/cli/
├── run-migrations.ts                 Better Auth migrations, then TypeORM migrations, as the owner role (MIGRATION_DATABASE_URL)
├── export-graphql-schema.ts          writes packages/sdk/schema.graphql from RESOLVERS, without a database
├── promote-super-admin.ts            operator-only: grants SUPER_ADMIN by email, writes an audit entry
└── seed-demo.ts                      development only: demo workspace through the real services; needs SEED_PASSWORD
```

### 2.3 `core/`

Core code knows nothing about tasks, sprints or HR. Feature modules depend on core, never the other way around. When core needs feature data, it defines a port and `app.module.ts` binds a feature adapter to it (see `membership-reader.port.ts`). The one exception is `orm-entities.ts`, because TypeORM needs every entity at startup.

```
src/core/
├── domain/
│   ├── domain-error.ts               DomainError (not_found | forbidden | invalid | conflict); no HTTP details
│   ├── found.ts                      found(value, 'Space'): the value or NOT_FOUND
│   └── page-request.ts               PageRequest and toPageRequest() for repository ports
├── time/
│   ├── clock.port.ts                 abstract class Clock; SystemClock and FixedClock (tests)
│   └── time.module.ts
├── auth/
│   ├── auth.module.ts
│   ├── better-auth.factory.ts        builds the Better Auth instance (plugins, rate limits, cookies)
│   ├── auth.service.ts               turns request headers into a SessionUser
│   ├── session.guard.ts              global guard: valid session or 401 (fails closed)
│   ├── auth-forms.ts                 password and name limits for the auth forms
│   └── mailer/
│       ├── mailer.port.ts            abstract class Mailer { sendPasswordReset(...) }
│       ├── console.mailer.ts         development adapter (prints links in dev only)
│       └── smtp.mailer.ts            ✅ production adapter (nodemailer, SMTP_URL and MAIL_FROM, bounded timeouts)
├── access/
│   ├── access.module.ts              AccessModule.forRoot({ membershipReader }) — the adapter is injected
│   ├── membership-reader.port.ts     abstract class MembershipReader { findGrant, workspaceExists }
│   ├── access.service.ts             resolves (user, workspace) → role + permissions
│   ├── workspace-access.guard.ts     checks membership and permissions for operations with a workspaceId argument
│   ├── platform-admin.guard.ts       SUPER_ADMIN-only operations; everyone else gets NOT_FOUND
│   ├── data-scope.interceptor.ts     runs each operation in one transaction with its row-level security scope (incl. space limits)
│   ├── space-guard.ts                SpaceGuard.assert(spaceId, permission): the caller's space-limited denies, for services
│   ├── sensitive-field.decorator.ts  @SensitiveField('member.email', ...): null unless the caller's policies allow it
│   ├── require-platform-admin.decorator.ts
│   ├── require-permissions.decorator.ts
│   └── current-access.decorator.ts
├── audit/
│   ├── audit.module.ts
│   ├── audit-logger.port.ts          abstract class AuditLogger { record(actor, entry) }
│   ├── audited.decorator.ts          @Audited('space.update', { metadata }): writes the entry in the same transaction
│   ├── typeorm-audit-logger.ts       adapter writing to audit_log
│   └── audit-log.orm-entity.ts
├── database/
│   ├── database.module.ts            TypeORM root config; provides UnitOfWork, TransactionalManager, health, RLS check
│   ├── data-source-options.ts
│   ├── snake-naming.strategy.ts
│   ├── base.orm-entity.ts            BaseOrmEntity, TenantOrmEntity (workspaceId)
│   ├── orm-entities.ts               single list of every ORM entity
│   ├── pg-pool.provider.ts           pg pool for Better Auth
│   ├── data-scope.ts                 DataScope (workspace | user | platform, plus space rules) and the SQL that applies it
│   ├── unit-of-work.port.ts          abstract class UnitOfWork { run(work), runInScope(scope, work) }
│   ├── typeorm-unit-of-work.ts       adapter; nested calls join the outer transaction
│   ├── transactional-manager.ts      the current transaction's EntityManager and scope (AsyncLocalStorage);
│   │                                 savepoint(work) undoes only the work's changes when it throws (automations)
│   ├── row-level-security.check.ts   startup check: no superuser/BYPASSRLS role, RLS forced on every tenant table
│   ├── database-health.indicator.ts  SELECT 1 for /health
│   └── migrations/
│       ├── index.ts                  ordered list of migrations
│       └── <timestamp>-<name>.ts     one file per migration, never edited after merge
├── cache/                            ✅ shared cache (Redis, in-memory fallback)
│   ├── cache-store.port.ts           abstract class CacheStore { get, set(ttl, tags), invalidateTags }; failures count as a miss
│   ├── redis.cache-store.ts          ioredis adapter: tag sets, one Lua script per invalidation, 250 ms command timeout
│   ├── memory.cache-store.ts         per-instance adapter for development and tests (bounded)
│   ├── cache-keys.ts                 tf:v1 prefix, workspace/user scoped keys, hashed arguments
│   ├── cached.decorator.ts           @Cached({ entities, shared?, ttlSeconds? }) for read methods; mutations always bypass it
│   ├── evicts-user-cache.decorator.ts    drops one user's cached entries after the method succeeds (pairs with @Cached({ user }))
│   ├── cache-invalidator.ts          drops tags on every domain event, in the transaction and again after commit on every instance
│   └── cache.module.ts
├── forms/                            ✅ validation rules published to clients
│   ├── form-field.decorators.ts      IsOmittable, IsClearable, IsNullable, IsNotBlank, IsCalendarDate, OnOrAfter, WithinDaysOf, SameAs, Label
│   ├── describe-rules.ts             class-validator metadata → rules with readable messages; per-field errors
│   ├── form-schema.decorators.ts     @FormSchema('task.create') registry and schema builder
│   └── field-validation.exception.ts BAD_USER_INPUT with extensions.fields
├── query/                            ✅ filter language for list endpoints
│   ├── query-resource.decorators.ts  @QueryResource and @QueryField: fields, SQL columns, operators, sorting, paging, permissions
│   ├── normalize-query.ts            checks a client query against a resource (fields, operators, values, @me, limits)
│   ├── compile-query.ts              filter tree → SQL with bound parameters only; ORDER BY with an id tie-breaker
│   ├── apply-resource-query.ts       adds filter, search, sort and paging to a TypeORM query builder
│   ├── evaluate-query.ts             the same semantics in memory, for test repositories
│   ├── resource-query.decorator.ts   @ResourceQueryArg() and @ValidatedQuery('tasks') for resolvers
│   ├── resource-schema.ts            the client-facing description of a resource, per caller
│   ├── enum-options.registry.ts      workspace-specific enum options (roles, custom statuses)
│   └── query.module.ts
├── runtime/                          ✅ support for method decorators
│   ├── decorator-runtime.ts          lets decorators look up Nest providers at call time
│   ├── method-decorator.ts           wrapMethod(): wraps an async method and keeps `this`
│   └── change-target.ts              actor (first argument) and changed entity (result) for @Audited/@Announces
├── events/                           ✅ domain events inside one process
│   ├── domain-event.ts               { type, workspaceId, actorId, entityType, entityId, subject? }; ids only, no data
│   ├── event-bus.port.ts             abstract class EventBus { publish(event) }; handlers register themselves
│   ├── in-process-event-bus.ts       runs handlers in order inside the caller's transaction
│   ├── announces.decorator.ts        @Announces('space.updated'): publishes the event after the method succeeds
│   └── events.module.ts
├── realtime/                         ✅ fan-out of events to every API instance (Postgres LISTEN/NOTIFY)
│   ├── realtime-event.ts             what goes on the wire, and its parser (untrusted input)
│   ├── realtime-channel.ts           channel name taskflow_events
│   ├── realtime-publisher.ts         pg_notify in the current transaction, so events go out only on commit
│   ├── realtime-listener.ts          one dedicated LISTEN connection per instance, reconnects with backoff
│   ├── event-stream.ts               per-subscriber async iterators with a bounded queue
│   ├── websocket-auth.ts             origin allowlist and session check for graphql-ws connections
│   └── realtime.module.ts
├── crypto/                           ✅ secrets the API must read back
│   ├── secret-box.ts                 SecretBox: AES-256-GCM seal/open, key derived from BETTER_AUTH_SECRET (HKDF); never in the DB
│   ├── secret-box.spec.ts
│   └── crypto.module.ts              global module exporting SecretBox
├── storage/                          🔜 [4] document attachments and HR files
│   ├── storage.port.ts               abstract class FileStorage { put, signedUrl, delete }
│   ├── s3.storage.ts                 adapter (MinIO locally), private bucket, short-lived URLs
│   └── file-type.validator.ts        magic-byte check, size limit, blocks HTML/SVG
├── graphql/                          code-first GraphQL at /api/graphql
│   ├── graphql-api.module.ts         Apollo driver; token limit, CSRF prevention; no introspection, playground or hints in production;
│   │                                 graphql-ws subscriptions on the same path (origin and session checked in onConnect)
│   ├── depth-limit.rule.ts           validation rule: rejects queries nested deeper than 8
│   ├── complexity.plugin.ts          rejects queries above a cost of 5000 (blocks alias amplification)
│   ├── page.type.ts                  PageOf<T>, PageArgs, WorkspacePageArgs (max 100), complexity estimators
│   ├── args.ts                       WorkspaceIdArg, UuidArg, OptionalUuidArg (null means "none")
│   ├── validation.ts                 @IsOmittable(): input fields that may be left out but never set to null
│   ├── enums.ts                      registerEnumType for shared-types enums
│   ├── json-object.scalar.ts         output-only JSONObject scalar (audit metadata)
│   ├── metadata.scalar.ts            flat key/value task metadata, checked on input
│   ├── custom-field-values.scalar.ts field id → value map; types checked by the service
│   └── resource-query.types.ts       GraphQL types for resource queries (filter tree, sort, paging) and ResourceSchema
└── http/
    ├── request-context.ts            the Express request, workspaceId argument and write detection for guards
    ├── types/authenticated-request.ts    SessionUser, WorkspaceAccess, Actor
    ├── decorators/
    │   ├── current-request.decorator.ts
    │   ├── public.decorator.ts
    │   ├── current-actor.decorator.ts
    │   └── current-user.decorator.ts
    ├── filters/all-exceptions.filter.ts  generic client errors as GraphQL error codes, details to logs
    ├── guards/user-throttler.guard.ts    rate limit by user, falling back to IP
    ├── pipes/uuid.pipe.ts            UUID_PIPE and OPTIONAL_UUID_PIPE
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
    └── graphql/
        ├── <feature>.resolver.ts     GraphQL only: @RequirePermissions, map arguments, call the service
        └── <entity>.types.ts         @ObjectType (implements the shared response type), @InputType and @ArgsType
                                      with class-validator rules (implements the shared request type)
```

Resolvers stay thin: guards check access and services hold the rules, so another transport could be added later without touching either. Every resolver is listed in `src/graphql-resolvers.ts`; a spec fails if a `*.resolver.ts` file is missing from it.

Tests sit next to the code they test: `application/<feature>.service.spec.ts` (using the fake from `testing/`) and `domain/<rule>.policy.spec.ts`. Services and policies throw `DomainError`, never Nest HTTP exceptions; `AllExceptionsFilter` turns the error kind into a GraphQL error code (`NOT_FOUND`, `FORBIDDEN`, `BAD_USER_INPUT`, `CONFLICT`).

### 2.5 Data access and row-level security

Every tenant table has Postgres row-level security, forced even for the table owner (migration `row-level-security`). Tenant policies read three transaction-local settings (`app.workspace_id`, `app.user_id`, `app.scope`), which `DataScope` sets:

| Scope | Set by | Can see |
|-------|--------|---------|
| `workspace` | `DataScopeInterceptor` after `WorkspaceAccessGuard` allowed the call | that workspace's rows |
| `user` | the interceptor for signed-in calls outside a workspace; the membership lookup in the guard | the caller's memberships and the workspaces and roles they point to |
| `platform` | the interceptor, only for SUPER_ADMIN on `@RequirePlatformAdmin` operations; operator CLIs | every row |

Space limits (IAM deny statements with `spaces` / `notSpaces`) travel in four more settings, set from the workspace scope's `spaceRules`: `app.space_task_deny` and `app.space_task_only` (spaces where `task.view` is denied, or the only ones allowed; `*` no limit, `-` none), and `app.space_doc_deny` / `app.space_doc_only` for `doc.view`. Migration `space-access` adds RESTRICTIVE `space_access` policies, which must pass alongside the tenant policy: on `space` and every table with a `space_id` (lists, folders, sprints, statuses, tasks, custom fields, time entries), on `document` (doc limits), and on task children (comments, activity, watchers, relations) through their task. Tasks carry a trigger-maintained `space_id`, so no join is needed. What RLS can't tell apart (editing versus viewing) is checked in services with `SpaceGuard`.

No scope means no tenant rows (fail closed). Repositories still filter by `workspaceId`; RLS is the second line of defence. The API connects as a role that owns nothing (`DATABASE_URL`), and migrations run as the schema owner (`MIGRATION_DATABASE_URL`). Within one operation, queries share one connection, so run them one after another, not with `Promise.all`.

### 2.6 Feature modules, file by file

```
src/modules/
├── health/                                       ✅
│   ├── health.module.ts
│   └── presentation/
│       └── health.controller.ts                  GET /api/health, @Public liveness probe for Docker (non-GraphQL, like the GitHub webhook)
│
├── users/                                        ✅
│   ├── users.module.ts
│   ├── domain/user.ts                            id, name, email, platformRole, suspended
│   ├── domain/user.repository.ts                 findByEmail, findById
│   ├── infrastructure/user.orm-entity.ts         read model over Better Auth's "user" table
│   ├── infrastructure/typeorm-user.repository.ts
│   └── presentation/graphql/{me.resolver.ts,user.types.ts}     query me
│
├── workspaces/                                   ✅
│   ├── workspaces.module.ts
│   ├── domain/workspace.ts
│   ├── domain/workspace.repository.ts
│   ├── application/workspaces.service.ts         create (id chosen up front; roles + owner in the new workspace's scope), update, delete
│   ├── application/workspace.mapper.ts
│   ├── infrastructure/workspace.orm-entity.ts
│   ├── infrastructure/typeorm-workspace.repository.ts
│   └── presentation/graphql/{workspaces.resolver.ts,workspace.types.ts}
│
├── roles/                                        ✅ roles and IAM policies
│   ├── roles.module.ts
│   ├── domain/workspace-role.ts                  direct permissions + inline policy
│   ├── domain/workspace-role.repository.ts
│   ├── domain/system-roles.ts                    built-in roles seeded per workspace (rights from managed policies)
│   ├── domain/role-grant.policy.ts               no granting permissions or fields you don't hold; owner-only permission
│   ├── domain/policy.ts                          custom policies, attachments, PolicyRef, effective access of a role
│   ├── domain/policy-document.policy.ts          validates documents (space limits: deny only, spaces or notSpaces); no granting more than you have
│   ├── domain/policy.repository.ts
│   ├── application/roles.service.ts              roles with their policies and effective access
│   ├── application/role-access.service.ts        effective access per role (cached; used by access checks)
│   ├── application/policies.service.ts           custom policy CRUD, attach/detach, inline; changes stay within the actor's access
│   ├── application/role.mapper.ts
│   ├── infrastructure/{workspace-role,policy,role-policy}.orm-entity.ts
│   ├── infrastructure/typeorm-{workspace-role,policy}.repository.ts
│   └── presentation/graphql/{roles.resolver.ts,role.types.ts,policies.resolver.ts,policy.types.ts}
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
│   ├── infrastructure/typeorm-membership.reader.ts             adapter for core's MembershipReader port (user/platform scope)
│   └── presentation/graphql/{members.resolver.ts,member.types.ts}
│
├── spaces/                                       ✅  (same layout: space.ts, space.repository.ts, spaces.service.ts, …)
│
├── lists/                                        ✅ lists and the folders that group them inside a space
│   ├── lists.module.ts
│   ├── domain/{task-list.ts,task-list.repository.ts}   a list may sit in a folder
│   ├── domain/{list-folder.ts,list-folder.repository.ts}   folders can hold folders; optional color and icon
│   ├── domain/folder-tree.policy.ts              no cycles, parent in the same space, nesting up to FOLDER_MAX_DEPTH
│   ├── application/{lists.service.ts,task-list.mapper.ts}
│   ├── application/folders.service.ts            folder CRUD and moves; deleting a folder moves its contents up a level
│   ├── infrastructure/{task-list,list-folder}.orm-entity.ts
│   ├── infrastructure/typeorm-{task-list,list-folder}.repository.ts
│   └── presentation/graphql/{lists.resolver.ts,folders.resolver.ts,task-list.types.ts}
│
├── tasks/                                        ✅
│   ├── tasks.module.ts
│   ├── domain/task.ts
│   ├── domain/task.repository.ts                 findInWorkspace, nextNumber, nextPosition, backlogInSpace, save, delete
│   ├── domain/task-extras.repository.ts          watchers, relations, activity ports
│   ├── domain/task-changes.ts                    describeChanges: field-level activity entries
│   ├── domain/task-assignment.policy.ts          needs task.assign; assignee must be a member
│   ├── domain/task-planning.policy.ts            sprint changes need sprint.manage and the same space
│   ├── domain/task-structure.policy.ts           subtasks: same list, max depth, no cycles
│   ├── application/tasks.service.ts
│   ├── application/task.mapper.ts
│   ├── infrastructure/task.orm-entity.ts
│   ├── infrastructure/typeorm-task.repository.ts
│   ├── infrastructure/task-extras.orm-entities.ts + typeorm-task-extras.repositories.ts
│   ├── infrastructure/task.query-resource.ts     filterable/sortable fields incl. statusCategory, metadata, custom.<key>
│   ├── testing/in-memory-task.repository.ts      plus watcher, relation and activity fakes
│   └── presentation/graphql/{tasks.resolver.ts,task.types.ts}
│
├── statuses/                                     ✅  per-space task statuses with categories; seeded on space.created
│   ├── domain/{task-status.ts,task-status.repository.ts}
│   ├── application/statuses.service.ts           create, update, reorder, delete (moves tasks to another status)
│   └── infrastructure/, presentation/graphql/
│
├── custom-fields/                                ✅  per-space field definitions for tasks and spaces
│   ├── domain/{custom-field.ts,custom-field-values.ts,custom-field.repository.ts}   values checked against the definitions
│   ├── application/custom-fields.service.ts      also registers custom.<key> as query fields
│   └── infrastructure/, presentation/graphql/
│
├── time-tracking/                                ✅  timers, logged time, daily log; own entries unless time.view_all / time.manage
│   ├── domain/{time-entry.ts,time-entry.policy.ts,time-entry.repository.ts}
│   ├── application/time-tracking.service.ts
│   └── infrastructure/, presentation/graphql/
│
├── analytics/                                    ✅  read-only dashboards; SQL aggregates with bound parameters only
│   ├── domain/analytics.repository.ts            port: counts, breakdowns, hours, workload, lists
│   ├── application/analytics.service.ts          scopes hours to the caller without time.view_all; cached
│   ├── infrastructure/sql-analytics.repository.ts
│   └── presentation/graphql/
│
├── comments/                                     ✅
│   ├── domain/{comment.ts,comment.repository.ts}
│   ├── application/{comments.service.ts,comment.mapper.ts}
│   ├── infrastructure/{comment.orm-entity.ts,typeorm-comment.repository.ts}
│   └── presentation/graphql/{comments.resolver.ts,comment.types.ts}
│
├── sprints/                                      ✅
│   ├── sprints.module.ts
│   ├── domain/sprint.ts                          name, goal, startDate, endDate, status
│   ├── domain/sprint.repository.ts
│   ├── domain/sprint-lifecycle.policy.ts         planned → active → completed; one active sprint per space
│   ├── domain/sprint-rollover.policy.ts          where unfinished tasks go on completion
│   ├── application/sprints.service.ts            create, start, complete with rollover (one transaction); uses the Clock port
│   ├── application/sprint.mapper.ts
│   ├── infrastructure/sprint.orm-entity.ts
│   ├── infrastructure/typeorm-sprint.repository.ts
│   └── presentation/graphql/{sprints.resolver.ts,sprint.types.ts}
│
├── documents/                                    ✅
│   ├── documents.module.ts
│   ├── domain/document.ts                        page tree via parentId, optional spaceId
│   ├── domain/document.repository.ts
│   ├── domain/content-sanitizer.port.ts          abstract class ContentSanitizer
│   ├── domain/document-tree.policy.ts            blocks cycles and limits nesting depth
│   ├── domain/document-access.policy.ts          doc.manage edits anything; doc.create edits own pages
│   ├── application/documents.service.ts
│   ├── application/document.mapper.ts
│   ├── infrastructure/document.orm-entity.ts
│   ├── infrastructure/typeorm-document.repository.ts
│   ├── infrastructure/markdown.sanitizer.ts      adapter for ContentSanitizer: control chars, unsafe link schemes
│   └── presentation/graphql/{documents.resolver.ts,document.types.ts}   attachments 🔜 (uploads via signed URLs, core/storage)
│
├── templates/                                    ✅ project templates: built-in gallery plus the workspace's own
│   ├── templates.module.ts
│   ├── domain/project-template.ts                a saved template (built-in ones live in shared-types, BUILT_IN_TEMPLATES)
│   ├── domain/project-template.repository.ts
│   ├── domain/template-content.policy.ts         normalizes untrusted content (built-in, saved or imported): bounded, refs point back
│   ├── application/templates.service.ts          list, apply (new space through the normal services, one transaction),
│   │                                             save a space as a template, import/export JSON, delete
│   ├── infrastructure/{project-template.orm-entity.ts,typeorm-project-template.repository.ts}
│   └── presentation/graphql/{templates.resolver.ts,template.types.ts}
│
├── automations/                                  ✅ per-space "when … then …" rules on tasks
│   ├── automations.module.ts
│   ├── domain/automation-rule.ts                 rule (trigger, conditions, actions) and its runs
│   ├── domain/automation.repository.ts
│   ├── domain/automation.policy.ts               normalizes triggers, conditions and actions; matches a task; permissions each action needs
│   ├── application/automations.service.ts        CRUD and enable; saving checks the saver may do every action in that space
│   ├── application/automation-engine.ts          runs rules on EventBus task events (and GitHub triggers) as the rule's saver,
│   │                                             each in its own savepoint; rule changes never fire other rules
│   ├── application/automation.mapper.ts
│   ├── infrastructure/{automation.orm-entities.ts,typeorm-automation.repository.ts}   automation_rule, automation_run
│   └── presentation/graphql/{automations.resolver.ts,automation.types.ts}   needs automation.manage to change
│
├── integrations/                                 ✅ GitHub through repository webhooks
│   ├── integrations.module.ts
│   ├── domain/github.ts                          connection (repo, task prefix, sync settings, sealed secret) and pull request links
│   ├── domain/github.repository.ts
│   ├── domain/github-webhook.policy.ts           HMAC-SHA256 signature check in constant time; parses pull_request events
│   ├── application/github-connections.service.ts connect, update, rotate secret (shown once, stored with SecretBox), remove; PRs per task
│   ├── application/github-webhook.service.ts     one delivery per transaction: signature, dedupe by delivery id,
│   │                                             link PRs to tasks they mention (TF-42), move tasks, fire automation triggers
│   ├── application/github.mapper.ts
│   ├── infrastructure/{github.orm-entities.ts,typeorm-github.repository.ts}
│   └── presentation/
│       ├── graphql/{github.resolver.ts,github.types.ts}   needs integration.manage
│       └── http/github-webhook.controller.ts     POST /api/integrations/github/webhook/:connectionId, @Public (signed),
│                                                 throttled; the only non-GraphQL feature route besides health
│
├── hr/                                           ✅ one parent module, three sub-features
│   ├── hr.module.ts
│   ├── departments/
│   │   ├── domain/{department.ts,department.repository.ts}
│   │   ├── application/{departments.service.ts,department.mapper.ts}
│   │   ├── infrastructure/{department.orm-entity.ts,typeorm-department.repository.ts}
│   │   └── presentation/graphql/{departments.resolver.ts,department.types.ts}
│   ├── employees/
│   │   ├── domain/{employee-profile.ts,employee-profile.repository.ts,reporting-line.policy.ts}
│   │   ├── application/{employees.service.ts,employee-profile.mapper.ts}
│   │   ├── infrastructure/{employee-profile.orm-entity.ts,typeorm-employee-profile.repository.ts}
│   │   └── presentation/graphql/{employees.resolver.ts,employee.types.ts}
│   └── leave/
│       ├── domain/leave-type.ts
│       ├── domain/leave-request.ts               pending → approved | rejected | cancelled
│       ├── domain/leave-balance.ts
│       ├── domain/leave-type.repository.ts       three small ports instead of one large one (ISP)
│       ├── domain/leave-request.repository.ts
│       ├── domain/leave-balance.repository.ts    lockUsedDays() takes a row lock (SELECT … FOR UPDATE)
│       ├── domain/leave-approval.policy.ts       approver needs leave.approve and can't approve their own request
│       ├── domain/leave-days.calculator.ts       working days between dates (pure, unit tested)
│       ├── domain/leave-request.policy.ts        range, one calendar year, no overlap
│       ├── application/leave-types.service.ts
│       ├── application/leave-requests.service.ts request, approve, reject, cancel; balance changes under a row lock
│       ├── application/leave.mapper.ts
│       ├── infrastructure/{leave-type,leave-request}.orm-entity.ts
│       ├── infrastructure/typeorm-leave-{type,request,balance}.repository.ts
│       └── presentation/graphql/{leave.resolver.ts,leave.types.ts}
│
├── notifications/                                ✅ inbox
│   ├── domain/notification.ts                    kind, recipient, actor, subject (entity type and id), readAt
│   ├── domain/notification-rules.ts              pure: which events notify whom (never about your own actions)
│   ├── domain/notification.repository.ts
│   ├── application/notification-event-handler.ts subscribes to the EventBus, writes notifications, announces them
│   ├── application/{notifications.service.ts,notification.mapper.ts}
│   ├── infrastructure/{notification.orm-entity.ts,typeorm-notification.repository.ts}
│   └── presentation/graphql/{notifications.resolver.ts,notification.types.ts}   own notifications only; mark read
│
├── realtime/                                     ✅ subscription workspaceEvents(workspaceId)
│   ├── application/workspace-events.service.ts   filters the stream by workspace and recipient; rechecks the session
│   │                                             and membership every 30 s and ends the stream when either is gone
│   └── presentation/graphql/{workspace-events.resolver.ts,workspace-event.types.ts}
│
├── forms/                                        ✅ public formSchemas query (rules only, no data)
│
├── preferences/                                  ✅ personal settings, table layouts, saved views, tabs (own row only, RLS)
├── layouts/                                      ✅ personal block-grid layouts per page (dashboard_layout, RLS: own rows in the workspace; optimistic versions)
│
├── resources/                                    ✅ resourceSchema and resourceNames queries
│   ├── application/resource-schema.service.ts    unknown and forbidden resources both answer NOT_FOUND
│   └── presentation/graphql/resource-schema.resolver.ts
│
├── audit-log/                                    ✅ read side of the audit log
│   ├── domain/{audit-entry.ts,audit-log.repository.ts}
│   ├── application/{audit-log.service.ts,audit-log.mapper.ts}   workspace view drops IPs
│   ├── infrastructure/typeorm-audit-log.repository.ts
│   └── presentation/graphql/{workspace-audit-log.resolver.ts,audit-log.types.ts}   needs audit.view
│
└── admin/                                        ✅ SUPER_ADMIN only
    ├── admin.module.ts
    ├── domain/{admin-user.ts,admin-user.repository.ts,admin-workspace.repository.ts}
    ├── domain/platform-role.policy.ts            no self-changes; keep one active super admin
    ├── application/{admin-users.service.ts,admin-workspaces.service.ts,admin.mapper.ts}
    ├── infrastructure/typeorm-admin-{user,workspace}.repository.ts
    └── presentation/graphql/
        ├── admin.resolver.ts                     users (suspend revokes sessions; promote/demote audited), workspaces,
        │                                         platform-wide audit log with IPs; platform scope
        └── admin.types.ts
```

---

## 3. Frontend: `apps/web`

The frontend mirrors the backend: one folder per feature, and the same direction of dependencies.

### 3.1 Top level

```
apps/web/
├── package.json
├── tsconfig.json
├── vite.config.ts                    React plugin, Tailwind, dev proxy for /api, unit test config
├── playwright.config.ts              browser e2e: starts the built API and Vite against a test database
├── e2e/
│   ├── support/stack.ts              ports and API env for the e2e stack (refuses non-test databases)
│   └── workspace-journey.spec.ts     sign-up → tasks → live updates → sprints → docs → HR → roles → audit → admin → inbox
├── components.json                   shadcn/ui config
├── index.html
├── Dockerfile                        build with Vite, serve with nginx as non-root
├── nginx.conf                        SPA fallback, security headers, no server tokens; WebSocket upgrade for /api/graphql
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
src/app/                              composition root (like app.module.ts on the API)
├── app.tsx                           <Providers><RouterProvider/></Providers>
├── providers.tsx                     QueryClientProvider, TooltipProvider, Toaster
├── routes.tsx                        the whole typed route tree; session guards; pages come from module index.ts files
├── query-client.ts                   retries (none on client error codes), stale times, UNAUTHENTICATED → sign-in
└── layouts/
    ├── workspace-layout.tsx          rail, side panel, top bar, workbench tabs and <Outlet/>; the open task (?task=) shows over any page
    ├── app-rail.tsx                  60px app rail: apps, inbox, panel toggle, appearance, account; G-then-key shortcuts
    ├── rail-areas.ts                 rail apps and which pages belong to each
    ├── workbench-tabs.tsx            tab strip: pin, reorder (drag or menu), close, Alt+T / W / 1–9 / ⇧[ ] shortcuts
    ├── workspace-sidebar.tsx         navigation, projects with live counts, workspace and people pages; resizable
    ├── app-topbar.tsx                workspace switcher, search, timer, live status, new task
    └── user-menu.tsx                 account menu, theme toggle, sign out (sidebar row or top-bar avatar)

src/core/
├── config/env.ts                     reads VITE_* values (nothing secret)
├── api/graphql-client.ts             the single createGraphQLClient() instance
├── api/realtime-client.ts            the single createRealtimeClient() instance (lazy WebSocket, reconnects)
├── api/current-user.api.ts           MeDocument, used by route guards and useCurrentUser
├── api/form-schemas.api.ts           every form's validation rules from the API (unknown rule kinds skipped)
├── api/preferences.api.ts            personal preferences, in the shared shape
├── auth/
│   ├── auth-client.ts                Better Auth React client + captcha header helper
│   ├── session.ts                    hasSession() for route guards
│   ├── use-current-user.ts           query me
│   ├── verify-email-banner.tsx       shown until the signed-in user confirms their email
│   └── turnstile-widget.tsx          CAPTCHA widget for public forms (off when no site key)
├── forms/
│   ├── use-form-schema.ts            all form rules, loaded once
│   ├── schema-resolver.ts            react-hook-form resolver from the API's rules (shared validateForm)
│   └── use-server-form.ts            useServerForm(name): resolver, server field errors, input hints
├── preferences/
│   ├── appearance.ts                 applies theme, accent and density to <html>; first-paint snapshot
│   ├── use-preferences.ts            server preferences with optimistic updates
│   └── preferences-effects.tsx       keeps <html> in sync with the signed-in user's choices
├── realtime/
│   ├── use-workspace-events.ts       subscribes while a workspace is open and refreshes the affected queries
│   ├── invalidations.ts              entity type → query keys to refresh
│   ├── realtime-status.store.ts      Zustand: live | connecting | offline
│   └── realtime-indicator.tsx        status dot in the top bar
├── workbench/
│   ├── tabs.ts                       pure tab rules: follow navigation, pin, close, reorder, limits
│   ├── describe-path.ts              label and icon for an in-app path
│   ├── workbench.store.ts            Zustand: open tabs (active tab remembered per browser)
│   └── use-workbench-sync.ts         loads tabs from preferences, saves changes (debounced 800 ms)
└── theme/use-theme.ts                light/dark preference

src/components/
├── ui/                               shadcn primitives, restyled with TaskFlow tokens
│   ├── button.tsx  input.tsx  textarea.tsx  label.tsx  select.tsx  checkbox.tsx
│   ├── dialog.tsx  sheet.tsx  dropdown-menu.tsx  popover.tsx  tooltip.tsx
│   ├── badge.tsx  avatar.tsx  card.tsx  separator.tsx  skeleton.tsx  tabs.tsx
│   ├── sonner.tsx
│   └── form-field.tsx                label, control and error, wired for screen readers
├── common/                           built from ui/, still feature-agnostic
│   ├── page-header.tsx  empty-state.tsx  error-state.tsx  confirm-dialog.tsx  full-page-spinner.tsx
│   ├── name-dialog.tsx               "name this thing" dialog checked by an API form schema
│   ├── entity-icon.tsx               ICONS for every icon key the API accepts; the icon of a space, folder, list or doc
│   ├── icon-picker.tsx               IconGrid and IconPicker: an icon grid plus a colour row
│   └── user-avatar.tsx  color-picker.tsx  color-dot.tsx  logo.tsx
├── kit/                              configurable building blocks used across features
│   ├── data-table.tsx                sort (multi), select, page, show/hide, reorder and resize columns; layout comes in and goes out
│   ├── modal.tsx                     sizes, eyebrow, header actions, footer, optional side column
│   ├── section.tsx                   collapsible block (accordion item), controlled or remembered per browser
│   ├── option-picker.tsx             popover list with search, optional clear row and a check on the current value
│   ├── range-calendar.tsx            day-range picker
│   ├── segmented.tsx  block.tsx (+ block-state.ts)  stat-card.tsx  status-pill.tsx
│   ├── charts.tsx                    columns, grouped columns, stacked bar, bar list, meter, line chart (no chart library)
│   └── notify.ts                     toast presets: success, info, error, undoable, promise
└── layout/
    ├── app-shell.tsx                 two-column frame: sidebar and page, content through props
    ├── sidebar-link.tsx
    └── sidebar-section.tsx

src/lib/
├── cn.ts                             clsx + tailwind-merge
├── dates.ts
├── days.ts                           calendar-day arithmetic on yyyy-mm-dd strings
├── periods.ts                        date windows for dashboards and time views ([from, to))
├── export-csv.ts                     CSV download built in the browser; defuses spreadsheet formulas
├── errors.ts                         safe user-facing messages from GraphQL error codes
├── use-resettable-state.ts           local draft of a value that resets when the source changes
├── initials.ts
└── query-keys.ts                     one factory for every TanStack Query key
```

### 3.3 Feature module template

```
src/modules/<feature>/
├── index.ts                          public surface: pages, hooks and components other code may use
├── api/<feature>.api.ts              calls the SDK's typed documents and unwraps the field (the only place that touches the SDK)
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
├── auth/            pages/{sign-in,sign-up,forgot-password,reset-password}.page.tsx, components/{auth-layout,form-error}.tsx, components/auth-schemas.ts
├── workspaces/      pages/{onboarding,workspace-settings}.page.tsx (settings include the GitHub integration)
│                    components/{workspace-switcher,create-workspace-dialog,workspace-form,can}.tsx, store/workspace-ui.store.ts
├── members/         pages/members.page.tsx, components/{add-member-dialog,role-select}.tsx
├── roles/           pages/roles.page.tsx, lib/permission-groups.ts
│                    components/{role-editor-dialog,role-access-dialog,policy-dialog,statement-editor}.tsx
│                      role-access-dialog: attached policies, inline statements and the space limits they add up to
│                      statement-editor: allow/deny statements, optionally limited to spaces (deny only)
│                    api/{roles,policies}.api.ts, hooks/{use-roles,use-policies}.ts
├── spaces/          components/space-tree.tsx (projects, folders and lists with icons and live counts; opens the template gallery)
│                    components/settings/{space-settings,status-settings,custom-field-settings}.tsx   a project's Settings view
│                    hooks/use-spaces.ts (incl. custom field definitions)
├── lists/           api/lists.api.ts, hooks/use-lists.ts (lists and folders)
├── templates/       components/template-gallery.tsx (built-in, saved or imported file), components/save-as-template.tsx,
│                    lib/download-template.ts (export as JSON)
├── automations/     components/{automations-panel,automation-builder}.tsx (a project's Automations view; "when" and "then" halves),
│                    lib/describe-rule.ts (trigger, action and audience labels)
├── integrations/    components/github-integration.tsx (repositories, webhook URL and secret, sync settings),
│                    components/pull-requests-section.tsx (linked pull requests in task detail)
├── tasks/           components/
│                      views/{list-view,bulk-bar,calendar-view,timeline-view,planner-view}.tsx
│                      board-view/{task-board-view,board-column,task-card}.tsx
│                      detail/task-detail.tsx            modal or side panel (preference), subtasks, relations, history
│                      shared/{status-picker,priority-picker,assignee-picker,due-date,task-dates,type-badge,quick-add-task}.tsx
│                      {command-search,new-task-dialog}.tsx
│                    hooks/{use-tasks,use-task-mutations,use-open-task}.ts, lib/{group-tasks,task-meta,export-tasks}.ts
├── projects/        pages/{project,my-tasks}.page.tsx: one page per project with twelve views (lib/views.ts) and a shared toolbar
│                    components/{project-tabs,saved-views-menu,task-table-view}.tsx, store/project-view.store.ts
├── resources/       components/{resource-table,filter-builder}.tsx: tables and filters built from `resourceSchema`; lib/filters.ts
├── dashboard/       pages/home.page.tsx (workspace overview on the block grid), lib/{dashboard-input,grid}.ts, hooks/use-layout.ts,
│                    components/{block-grid,block-library,home-blocks}.tsx
│                    components/{project-dashboard,dashboard-panels,projects-table,dashboard-filters,dashboard-task-list,space-status-chip}.tsx
├── time/            pages/{timesheets,daily-log}.page.tsx, components/{log-time-dialog,task-time-controls,timer-indicator,time-report}.tsx,
│                    lib/time-format.ts
├── comments/        components/comment-thread.tsx
├── sprints/         pages/{sprints,sprint-board}.page.tsx
│                    components/active-sprint-panel.tsx   running sprint: time elapsed, done, burndown, workload
│                    components/{sprint-lane,sprint-task-row,backlog-panel}.tsx   drag-and-drop planning
│                    components/{sprint-form-dialog,complete-sprint-dialog,sprint-progress}.tsx
│                    lib/sprint-metrics.ts (timing, burndown, summary, workload), lib/sprint-dates.ts
├── documents/       pages/documents.page.tsx
│                    components/{doc-tree,folder-view,doc-editor,markdown-preview}.tsx   tree with drag to move; folder contents; autosave editor
│                    lib/build-tree.ts (flat list → tree), lib/drop-target.ts (before | inside | after a row)
├── hr/              pages/{directory,departments,time-off,approvals,leave-types}.page.tsx, lib/{hr-labels,working-days}.ts
│                    components/{profile-dialog,leave-request-dialog,leave-type-dialog,leave-balance-card,leave-status-badge}.tsx
├── inbox/           pages/inbox.page.tsx, components/notification-item.tsx, lib/describe-notification.ts
├── preferences/     pages/appearance.page.tsx (theme, accent, radius, density, font), components/{appearance-preview,theme-card}.tsx, lib/appearance-options.ts
├── audit-log/       pages/workspace-audit-log.page.tsx, components/{audit-log-table,audit-filter}.tsx
└── admin/           pages/{admin-users,admin-workspaces,admin-audit-log}.page.tsx, components/{admin-layout,pager,search-box}.tsx
```

Each module above also has its own `index.ts`, `api/` and `hooks/` (and `store/` where it keeps UI state). `workspaces/` also owns `usePermissions` and `<Can>`, since permissions are per workspace. Route paths live in `app/routes.tsx`, not in modules, so TanStack Router can type-check every link.

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
    │   ├── iam.ts                    ✅ policy statements and documents, SPACE_SCOPED_PERMISSIONS, SpaceRule, space visibility
    │   ├── workspace.ts              ✅ NAME_MAX, COLOR_PATTERN
    │   ├── hierarchy.ts              ✅ FOLDER_MAX_DEPTH, FOLDERS_PER_SPACE_MAX, ICON_KEYS for spaces, folders, lists and docs
    │   ├── task.ts                   ✅ TASK_STATUSES, TASK_PRIORITIES, limits
    │   ├── custom-field.ts           ✅ CUSTOM_FIELD_TYPES, SPACE_STATUSES, limits
    │   ├── time-tracking.ts          ✅ TIME_LIMITS, minute helpers
    │   ├── pagination.ts             ✅ PAGE_SIZE_MAX, Paginated<T>
    │   ├── sprint.ts                 ✅ SPRINT_STATUSES, limits
    │   ├── document.ts               ✅ limits
    │   ├── template.ts               ✅ TemplateContent, TEMPLATE_CATEGORIES, TEMPLATE_LIMITS, BUILT_IN_TEMPLATES
    │   ├── automation.ts             ✅ AUTOMATION_TRIGGERS, AUTOMATION_ACTIONS, NOTIFY_AUDIENCES, run statuses, limits
    │   ├── github.ts                 ✅ repo and task prefix patterns, PR states, sync settings, taskReferences() (TF-42)
    │   ├── notification.ts           ✅ NOTIFICATION_KINDS, REALTIME_ENTITY_TYPES
    │   ├── preferences.ts            ✅ themes, accents, densities, task views
    │   └── hr.ts                     ✅ LEAVE_STATUSES, EMPLOYMENT_TYPES, limits
    ├── forms/                        ✅ form schema shape and validateForm (same rules as the API)
    ├── query/                        ✅ filter language, query-string parser, ResourceSchema
    └── contracts/                    request and response shapes, one file per feature
        ├── user.contract.ts          ✅
        ├── workspace.contract.ts     ✅
        ├── member.contract.ts        ✅
        ├── role.contract.ts          ✅
        ├── policy.contract.ts        ✅
        ├── space.contract.ts         ✅
        ├── list.contract.ts          ✅ lists and folders
        ├── task.contract.ts          ✅
        ├── custom-field.contract.ts  ✅
        ├── comment.contract.ts       ✅
        ├── sprint.contract.ts        ✅
        ├── time.contract.ts          ✅
        ├── analytics.contract.ts     ✅
        ├── document.contract.ts      ✅
        ├── template.contract.ts      ✅
        ├── automation.contract.ts    ✅
        ├── github.contract.ts        ✅
        ├── notification.contract.ts  ✅
        ├── hr.contract.ts            ✅
        └── admin.contract.ts         ✅
```

## 5. `packages/sdk`

The typed contract between the API and its clients. No runtime dependencies.

```
packages/sdk/
├── package.json
├── tsconfig.json
├── schema.graphql                    ✅ written by `pnpm --filter @taskflow/api graphql:export`
├── operations/                       ✅ every operation the clients run, one file per feature
│   ├── fragments.graphql             one fragment per object type, selecting every field
│   ├── <feature>.graphql             queries and mutations (Tasks, CreateTask, …)
│   ├── templates.graphql             template gallery, apply, save from space, import/export
│   ├── automations.graphql           automation rules and their runs
│   └── integrations.graphql          GitHub connections, secret rotation, pull requests of a task
├── scripts/
│   └── generate-graphql-types.mjs    ✅ @graphql-codegen/core: validates operations against the schema, then
│                                        typescript-operations + typed-document-node (documents as plain strings)
└── src/
    ├── index.ts                      ✅ both clients plus everything generated
    ├── graphql-client.ts             ✅ createGraphQLClient(): typed request(document, variables), cookie auth,
    │                                    JSON only (passes CSRF prevention), GraphQLRequestError with the error code
    ├── realtime-client.ts            ✅ createRealtimeClient(): graphql-ws subscriptions, lazy connect, reconnects, status
    ├── graphql-error.ts              ✅ the error shape, kept local so there's no runtime graphql dependency
    └── generated/graphql.ts          ✅ enums, inputs, fragment and operation types, typed documents; never edit by hand
```

Flow: resolver types → `schema.graphql` → `operations/*.graphql` are validated against it → `generated/graphql.ts` → web `*.api.ts`. Run `pnpm sdk:generate` after changing a resolver or an operation, and commit the outputs. CI fails when they're stale.

---

## 6. `infra`

```
infra/
├── docker/
│   ├── docker-compose.yml            postgres, redis, migrate (one-off, owner role), api (runtime role), web, mailpit (local inbox);
│   │                                 private network; only web, Mailpit UI and Postgres (for local tools) on 127.0.0.1
│   ├── docker-compose.dev.yml        dev stack: postgres, redis, mailpit, one-off bootstrap, then api and web with live reload
│   ├── dev/
│   │   └── bootstrap.sh              idempotent install, build, migrate, optional demo seed for the dev stack
│   └── postgres/
│       └── 01-app-role.sh            schema owner (migrations) and runtime role (data only); neither superuser nor BYPASSRLS
└── terraform/                        the same local stack, via the kreuzwerker/docker provider
    ├── versions.tf                   pinned provider versions
    ├── providers.tf
    ├── variables.tf                  secrets marked sensitive, no defaults (Turnstile defaults to Cloudflare's test keys)
    ├── network.tf
    ├── postgres.tf                   container + named volume
    ├── redis.tf                      shared cache: memory only, password protected, backend network only
    ├── api.tf                        image built from apps/api/Dockerfile
    ├── web.tf                        image built from apps/web/Dockerfile
    ├── mail.tf                       Mailpit container, the default SMTP target
    ├── outputs.tf                    URLs only, never secrets
    ├── .terraform.lock.hcl           committed provider checksums
    └── terraform.tfvars.example
```

---

## 7. SOLID rules and where they live

| Principle | Rule in this repo | Example |
|-----------|-------------------|---------|
| **S**ingle responsibility | One reason to change per file. Resolvers map GraphQL arguments to service calls, services hold use cases, repositories handle persistence, mappers shape responses, policies hold one business rule, guards make one check. `main.ts` only calls `bootstrap/*`. Aim for files under ~200 lines. | `role-grant.policy.ts` holds the anti-escalation rule, and both `roles.service.ts` and `members.service.ts` use it. |
| **O**pen/closed | Extend by adding, not editing. New permissions and roles are data. New providers (mail, storage, CAPTCHA, sanitizer) are new adapters behind an existing port. New features are new modules. | Switching `ConsoleMailer` to `SmtpMailer` changes one line in `auth.module.ts`. |
| **L**iskov substitution | Every adapter honours its port's contract: the same nulls, errors and ordering. Test fakes must behave like the real adapter. | `TaskRepository.findInWorkspace` returns `null` when not found in both `TypeOrmTaskRepository` and the in-memory fake. |
| **I**nterface segregation | Ports stay small and feature-specific; no generic `BaseRepository<T>` with dozens of methods. React components take only the props they render. | `TaskRepository` exposes the five methods `TasksService` needs; `<TaskCard>` takes a `task` and an `onOpen`. |
| **D**ependency inversion | Services depend on abstract classes in `domain/` (Nest uses them as DI tokens); modules bind them to adapters. On the web, pages depend on hooks, hooks on `*.api.ts`, and only `*.api.ts` touches the SDK. | `{ provide: TaskRepository, useClass: TypeOrmTaskRepository }` in `tasks.module.ts`. |

### Import boundaries (enforced by `eslint.config.js`)

| From | May import | Must not import |
|------|------------|-----------------|
| `modules/*/domain` | `@taskflow/shared-types`, `core/domain`, other files in `domain/` | Nest, TypeORM, `infrastructure/`, `presentation/` |
| `modules/*/application` | own `domain/`, `core/*` ports, other modules' exported services and domain policies | `infrastructure/`, `presentation/`, TypeORM |
| `modules/*/infrastructure` | own `domain/`, TypeORM, `core/database` | `presentation/` |
| `modules/*/presentation` | own `application/`, `core/access`, `core/graphql`, `core/http` | `infrastructure/`, TypeORM |
| `core/*` | other `core/*`, `config/` | `modules/*` (except `core/database/orm-entities.ts`) |
| web `components/*`, `lib/*` | `lib/`, other `components/*` | `modules/*`, `core/api` |
| web `modules/<a>` | `components/`, `core/`, `lib/`, `modules/<b>` (its `index.ts`) | another module's internal files; `@taskflow/sdk` outside `api/` |

### Naming

- File names are kebab-case and end with their role: `.module.ts`, `.resolver.ts`, `.types.ts` (GraphQL types), `.service.ts`, `.repository.ts` (port), `typeorm-*.repository.ts` (adapter), `.orm-entity.ts`, `.policy.ts`, `.mapper.ts`, `.port.ts`, `.spec.ts`, `.e2e-spec.ts`. On the web: `.api.ts`, `use-*.ts`, `.store.ts`, `.page.tsx`. SDK operations: `operations/<feature>.graphql`.
- Classes are PascalCase and match the file: `typeorm-task.repository.ts` → `TypeOrmTaskRepository`.
- Ports are abstract classes, not TypeScript interfaces, because Nest needs a runtime token.
