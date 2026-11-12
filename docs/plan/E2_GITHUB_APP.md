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
2. **Install from TaskFlow**: Settings → GitHub → *Install on GitHub* (needs `workspace.manage`).
   GitHub sends the person back with the installation id, an OAuth code and our signed `state`
   (workspace, person, ten minutes, single use). TaskFlow trades the code for the person's
   GitHub token and keeps the installation only if GitHub lists it among that person's
   installations, so nobody can attach someone else's installation (IDOR). Audited.
   Then they pick repositories from the installation; each becomes a connection.
3. **GitHub → TaskFlow without a public URL**: with no webhook secret, a poller asks GitHub
   every minute for pull requests and issues updated since the last look, and feeds them to the
   same handling as webhooks (each change handled once). With the webhook on, `/api/integrations/
   github/app-webhook` takes events for all installations (signature checked against the raw body).
4. **TaskFlow → GitHub, issues**: *Create GitHub issue* from a task links the two. Title and
   open / closed follow each other both ways (done or cancelled closes the issue; reopening
   either reopens the other). Writes go out after the change commits, through an outbox with
   retries. Each side remembers what sync last set, so an echo isn't applied twice, and a change
   made by hand on both sides becomes a conflict card, as for pull requests today.

## Security

Installation ids belong to one workspace (RLS, like the other GitHub tables). Tokens are never
written to the database or logs. GitHub's responses are untrusted input: validated, size- and
time-limited. Outgoing writes run as the app, limited to the connected repositories, and only
for tasks the connection's owner may edit.
