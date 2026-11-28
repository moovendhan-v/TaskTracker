# E6 — Visual bug reporting, QA and MCP

Extends TaskFlow; reuses tasks (a bug **is** a task of type `bug`, so assignment, comments,
sprints, watchers, attachments, automations, GitHub sync and the `duplicates` relation all apply),
permissions (space-scoped), storage (private bucket, signed links, magic-byte checks, virus scan)
and the audit log. Nothing here rebuilds those.

## References and licences (checked 2026-11-26)

| Project | Licence | Use in TaskFlow |
|---|---|---|
| rrweb (rrweb-io/rrweb) | MIT | **Dependency** for session recording and replay. |
| Crikket (redpangilinan/crikket) | AGPL-3.0 | Patterns only (capture flow, extension UX). **No code copied.** |
| BugPin (aranticlabs/bugpin) | AGPL-3.0 | Patterns only (annotation, widget). **No code copied.** |
| ZenTao (easysoft/zentaopms) | ZPL-1.2 / AGPL-3.0 | Patterns only (case → suite → plan → run model). **No code copied.** |
| Jam.dev | proprietary SaaS | Product inspiration only. |

AGPL/ZPL code can't be copied into TaskFlow without putting TaskFlow under those terms, so
everything below is written from scratch.

## Checklist

### 0. Ground work
- [x] CI green again (test typecheck, generated-file lint warning, compose placeholder for MinIO)
- [x] Rate-limit Redis connects lazily (the migration CLI no longer hangs when REDIS_URL is set)
- [x] API tokens with scopes (bugs:read / bugs:write; tasks:* reserved for MCP): PKCE connect, hashed, 90-day expiry, revocable, audited

### 1. Bug reports (API)
- [x] `bug_report` (1:1 with a `bug` task): kind (bug, suggestion, enhancement, feature request),
      severity P0–P4, environment (development, UAT, staging, production), module, expected and
      actual results, manual + captured reproduction steps, page URL, browser, OS, viewport,
      QA state (new → confirmed → fixed → retest → verified / reopened / closed)
- [x] Diagnostics (`bug_capture`): console logs, JS errors, network requests (failed ones marked),
      user actions; redacted (tokens, cookies, auth headers, passwords, keys) and size-capped
- [~] Screenshots, recordings (WebM/MP4) and replay files through task attachments (WebM/MP4 accepted by magic bytes; replay files with the SDK)
- [x] Duplicate detection (similar titles in the project) and linking through `duplicates`
- [x] Retest / reopen / verify, recorded in task activity
- [x] Shareable read-only links (random, hashed, 1/7/30 days, revocable, audited); status-only tracking links for reporters
- [x] GraphQL API, permissions, activity, e2e tests (`test/e2e/bugs.e2e-spec.ts`)
- [x] Values typed into secret-looking fields are never kept, and never appear in generated steps

### 2. Bug reports (web)
- [x] Bugs view per project: filters (kind, severity, environment, QA state), duplicate badge
- [x] Bug detail panel: screenshots, recordings, steps, console, network, actions, QA actions, possible duplicates; comments / assignee / history on the task (one click)
- [ ] rrweb replay player (with the SDK)
- [x] Report a bug dialog in the app (screenshot + annotation incl. pixelate, recording with optional mic, element pick, auto diagnostics, similar-report warning)
- [x] Client / QA feedback portal (`/f/<key>`): public intake per project with origin checks, CAPTCHA, honeypot, per-IP and per-project limits; reporters follow progress at `/f/track/<token>`

### 3. Capture SDK and browser extension
- [x] `packages/bug-capture`: console, errors, network (fetch/XHR, GraphQL errors), clicks/inputs → steps,
      environment detection, element picker, annotation canvas, recording (MediaRecorder), redaction
- [ ] rrweb session replay in `packages/bug-capture`
- [x] Embeddable widget (`packages/feedback-widget`, served at `/embed/v1/feedback.js`): one `<script>` tag, shadow DOM, console/network/clicks capture, screenshot, CAPTCHA; real-browser e2e from another origin
- [x] Browser extension (Manifest V3, Chrome + Firefox) using the same capture core and an API token (`apps/extension`):
      connect, screenshot + annotate, element pick, tab recording, per-tab or always-on capture, duplicate warning; real-browser e2e;
      downloadable per browser at `/downloads/extension/latest`

### 4. QA and test management
- [x] Test cases (steps, expected), suites, plans (sprint / release), runs with results
      (passed, failed, blocked, skipped) and history
- [x] Failed case → bug with the run's details; a passing retest verifies it, a failing one reopens it
- [x] Links to tasks (covered features), bugs, sprints and releases
- [x] QA approval / rejection of a plan (project admins; failures need a note; approved plans frozen; audited)
- [x] Coverage (features with tests, never run, flaky) and release readiness checks

### 5. MCP server
- [ ] Streamable HTTP MCP endpoint, API-token auth with read / write scopes and space limits
- [ ] Tools: search/get bugs, diagnostics, steps, attachments; create/update bugs and tasks;
      test cases and results; status, priority, assignee; comments
- [ ] Every call audited (agent, tool, resource, before/after, outcome); activity shows AI changes apart
