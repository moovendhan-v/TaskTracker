# TaskFlow v2: build status

This tracks the v2 design handoff ([docs/design/v2/README.md](../design/v2/README.md)) against what this repo already has. The handoff asks us to fill in this table first, then build the ⬜ and 🟡 rows in its phase order (§10), and never rebuild a working module just to match the mockups.

We keep **our stack** (NestJS + GraphQL + TypeORM + Postgres RLS, React + Vite + TanStack + shadcn/ui), not the Next.js/Prisma stack in the handoff's §1. The handoff's "Org" maps to our platform level and its "Workspace" to our workspace.

Legend: ✅ built · 🟡 partial · ⬜ not started. "Gap" lists what v2 adds on top of what exists.

| # | Module | Status | What exists | Gap to v2 |
|---|---|---|---|---|
| A1 | Theme tokens + Appearance | ✅ | v2 zinc tokens, accents, `data-radius` / `data-density` / `data-font`, Geist + Geist Mono, Settings → Appearance with a live preview; all saved per user (`user_prefs` jsonb) | Sidebar mode, tab behaviour, reduced motion and code font prefs (they belong with A2) |
| A2 | App shell: Rail + Workbench tabs | 🟡 | Tab strip under the top bar: every page opens in a tab that follows navigation; pin (icon only, keeps its page), close, close others, reorder by drag or menu, real names for projects / lists / docs / sprints; saved to the account and restored on any device; Alt+T / Alt+W / Alt+1–9 / Alt+⇧[ ] | 60px rail, split view, per-tab scroll restore, search and Arrange in the strip. Shortcuts use Alt because browsers reserve ⌘T / ⌘W |
| A3 | Org → Workspaces → Spaces | 🟡 | Workspace → Space → List, workspace switcher, platform admin console | An org layer above workspaces (billing, shared HR / IAM / audit), ARN-like resource names |
| A4 | Auth, SSO, workspace restore | 🟡 | Better Auth email + password, password reset, Turnstile CAPTCHA, email verification | SSO, GitHub login, passkeys, the "Restoring your workspace…" screen |
| B1 | Block frame + states | ⬜ | Dashboard panels and stat cards (fixed layout) | Generic block frame with loading / empty / error / no-access states and a per-block error boundary |
| B2 | Lego grid + Arrange mode + library | ⬜ | | Grid layout, arrange mode (`E`), block library drawer (`A`) |
| B3 | Block config drawer | ⬜ | | Data source vs view config per block |
| B4 | Layout persistence, versions, sync conflict | ⬜ | Table layouts and saved views persist per user | Layouts table with versions, `If-Match` saves, conflict toast, reset with preview |
| B5 | Sidebar presets + templates gallery | 🟡 | Project templates (gallery, save as template, download) | Sidebar presets, layout / automation / doc templates, `.tflow` import / export |
| C1 | Tracker views | ✅ | List, Board, Table, Calendar, Timeline, Team planner, Time report, saved views, filters, bulk bar, grouping | v2 visual pass, swimlanes, WIP limits, J/K/X keyboard navigation, number-key status shortcuts |
| C2 | Task detail (full page + peek) | ✅ | Modal / side / page modes, subtasks, comments, time, multiple assignees, custom fields, linked PRs | Checklist, relations (blocks / duplicates), Development card (create branch / PR), activity tabs, ↑/↓ stepping in peek |
| C3 | Sprints | 🟡 | Sprint list, planning (backlog ↔ sprint lanes), board, progress, burndown, velocity, complete-sprint dialog | Per-person capacity lanes with leave, health strip with forecast, 3-step complete flow with report + "Sprint end" automation |
| C4 | Dashboards | 🟡 | Home overview and per-project dashboards with KPIs and charts | Multiple dashboard tabs with visibility (Private / Team / Workspace), built on the block grid (needs B1–B4) |
| C5 | Docs | 🟡 | Tree with drag and drop, markdown + visual editor, slide presentation, export | Live cursors (Yjs), task embeds and `TF-` autocomplete, embedded live views |
| C6 | Inbox | ✅ | Notification inbox with unread counts and live updates | Side-panel variant inside the workbench |
| D1 | Chat | ⬜ | | Channels, DMs, threads, create task from message |
| D2 | Video calls, huddles | ⬜ | | Needs an SFU (LiveKit or similar); calls, lobby, PiP |
| D3 | Virtual office | ⬜ | | Isometric floor + flat grid, presence states |
| E1 | Automations | 🟡 | Rule builder: 9 triggers (task + GitHub PR), 5 actions, runs as the rule's owner | Flow canvas, conditions / branches / waits, run history and traces, bigger node catalogue |
| E2 | GitHub sync | 🟡 | GitHub App connections, verified webhooks, PR ⇄ task linking by key, status on PR open / merge | Field mapping table with direction, conflict cards, live sync log, PR inbox for unlinked PRs |
| E3 | IAM | 🟡 | Built-in and custom roles, allow / deny policy statements scoped to spaces, audit log | Policy simulator, explained denials with "Request access", time / MFA conditions |
| E4 | HR | 🟡 | Directory, departments, leave types, time-off requests, approvals, timesheets, daily log | Clock-in / out with breaks, attendance view, leave calendar month grid |
| F1 | Mobile / tablet | ⬜ | Desktop-first; little responsive handling | Tablet slide-overs, phone stacked layout with bottom tab bar and quick-add sheet |

## Next up

Following the handoff's build order (§10), with A1 done:

1. **A2 rest**: the 60px rail replacing the wide sidebar (sidebar mode preference), then split view.
2. **B1 block frame**: a shared frame with all the states, then move the existing dashboard panels into it. This sets up B2–B4 and C4.
3. **C1 / C2 visual pass** against `TaskFlow v2 Features.dc.html` `#13a` and `#14a`.

Chat, calls and the virtual office (D1–D3) are new products, not gaps. Each needs its own plan (data model, realtime, RLS policies) before any code.
