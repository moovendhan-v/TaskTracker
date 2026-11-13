# E2: Two-way GitHub sync through a GitHub App

Today a workspace connects one repository with a webhook it adds by hand, and changes flow one
way (pull requests move tasks). With the TaskFlow GitHub App, a workspace installs the app once
and changes flow both ways.

## Settings

`GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_PRIVATE_KEY` (all or
none), plus `GITHUB_APP_CLIENT_SECRET` (needed to install from TaskFlow) and
`GITHUB_APP_WEBHOOK_SECRET` (optional). `pnpm --filter @taskflow/api github-app:check` checks
them against GitHub.

## Phases

1. **App client** (done): the app signs in with a short-lived JWT, gets installation tokens
   (cached in memory until shortly before they expire, never stored), and calls GitHub with
   timeouts. Every response is checked before use.
2. **Install from TaskFlow** (done): Settings → GitHub → *Install on GitHub* (needs `integration.manage`).
   GitHub sends the person back with the installation id, an OAuth code and our signed `state`
   (workspace and person, signed, valid for ten minutes and only for that person). TaskFlow trades the code for the person's
   GitHub token and keeps the installation only if GitHub lists it among that person's
   installations, so nobody can attach someone else's installation (IDOR). Audited.
   Then they pick repositories from the installation; each becomes a connection.
3. **GitHub → TaskFlow without a public URL** (done: polling, and the app webhook): with no webhook secret, a poller asks GitHub
   every minute for pull requests and issues updated since the last look, and feeds them to the
   same handling as webhooks (each change handled once). With `GITHUB_APP_WEBHOOK_SECRET` set,
   `/api/integrations/github/app-webhook` takes events for all installations at once (signature
   checked against the raw body, each delivery handled once per connection): pull requests and
   issues for connected repositories, and an uninstall on GitHub forgets the installation
   everywhere. The poller stays on as a safety net; settings say which mode is active and show
   the webhook URL to set on GitHub.
4. **TaskFlow → GitHub, issues** (done): *Create GitHub issue* from a task links the two. Title and
   open / closed follow each other both ways (done or cancelled closes the issue; reopening
   either reopens the other). Writes go out after the change commits, through an outbox with
   retries. Each side remembers what sync last set, so an echo isn't applied twice. When both
   sides changed since sync last agreed, TaskFlow's change wins and is sent (logged in the sync
   log).

## What it looks like

- **Workspace settings → GitHub**: *Install on GitHub*, the installations, *Connect a repository*
  (a list of the repositories the app can reach). App connections are marked *GitHub App ·
  two-way* and have no webhook secret.
- **Task → Development**: the task's issues (open / closed, *Syncing* while a change is on its
  way, an error if GitHub refused it) and *Open GitHub issue*.
- After GitHub sends someone back, settings say how it went (installed, not yours, failed).

## Tests

`test/e2e/github-app.e2e-spec.ts` runs against `support/fake-github.ts`, a stand-in for GitHub
that checks the app's JWTs and OAuth codes: installing only installations GitHub lists for that
person (not someone else's, not with a forged state, not signed out), connecting only reachable
repositories, the first poll linking without moving tasks, later pull request changes moving
them, and issues both ways without echoes.

## Security

Installation ids belong to one workspace (RLS, like the other GitHub tables). Tokens are never
written to the database or logs. GitHub's responses are untrusted input: validated, size- and
time-limited. Outgoing writes run as the app, limited to the connected repositories, and only
for tasks the connection's owner may edit.
