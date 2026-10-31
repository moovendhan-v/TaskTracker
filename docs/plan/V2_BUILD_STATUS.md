# TaskFlow v2: build status

This tracks the v2 design handoff ([docs/design/v2/README.md](../design/v2/README.md)) against what this repo already has. The handoff asks us to fill in this table first, then build the ⬜ and 🟡 rows in its phase order (§10), and never rebuild a working module just to match the mockups.

We keep **our stack** (NestJS + GraphQL + TypeORM + Postgres RLS, React + Vite + TanStack + shadcn/ui), not the Next.js/Prisma stack in the handoff's §1. The handoff's "Org" maps to our platform level and its "Workspace" to our workspace.

Legend: ✅ built · 🟡 partial · ⬜ not started. "Gap" lists what v2 adds on top of what exists.

| # | Module | Status | What exists | Gap to v2 |
|---|---|---|---|---|
| A1 | Theme tokens + Appearance | ✅ | v2 zinc tokens, accents, `data-radius` / `data-density` / `data-font`, Geist + Geist Mono, Settings → Appearance with a live preview; all saved per user (`user_prefs` jsonb) | Sidebar mode, tab behaviour, reduced motion and code font prefs (they belong with A2) |
| A2 | App shell: Rail + Workbench tabs | ✅ | 60px app rail (logo, inbox with unread dot, Home / Tracker / Docs / Time / People / Workspace, panel toggle, Appearance, account with live-presence dot; `G` then H / I / T / D / M / P); side panel shown or hidden (Appearance → Sidebar); tab strip where every page opens in a tab that follows navigation, with pin, close, reorder by drag or menu, real names, saved to the account; Alt+T / W / 1–9 / ⇧[ ] | Split view, per-tab scroll restore, search and Arrange in the strip, rail sprint widget, a "Hidden" sidebar mode. Chat / Video / Automations join the rail when built. Tab shortcuts use Alt because browsers reserve ⌘T / ⌘W |
| A3 | Org → Workspaces → Spaces | 🟡 | Workspace → Space → List, workspace switcher, platform admin console | An org layer above workspaces (billing, shared HR / IAM / audit), ARN-like resource names |
| A4 | Auth, SSO, workspace restore | 🟡 | Better Auth email + password, password reset, Turnstile CAPTCHA, email verification | SSO, GitHub login, passkeys, the "Restoring your workspace…" screen |
| B1 | Block (widget) frame + states | ✅ | `components/kit/block.tsx`: 40px header (icon, title, chip incl. "linked" tone, aside, toolbar, ⋯ menu with Maximise / Open as tab / custom actions), arrange look (dashed accent + grip), states loading (rows or chart skeleton) / empty / error with retry / no-access (hatched), per-block crash boundary; `blockStateOf(query)` maps a query to a state (FORBIDDEN → no-access). Home and project dashboards use it | Stacked tabs in one slot, keyboard shortcuts on a focused block (C, ⌘D, M), "Request access" (needs an access-request flow) |
| B2 | Lego grid + Arrange mode + library | 🟡 | Home dashboard: 12-column block grid; arrange mode (`E`, Esc) with dashed outlines, grips, drag anywhere on a block with a live drop slot, corner resize, × remove with 10 s Undo toast, ⌘Z / Undo, ⌥+arrows move and ⇧⌥+arrows resize with screen-reader announcements; library drawer (`A`) with search and categories. Stacks to one column under 1024px. Plan: [B2_LAYOUT_GRID.md](B2_LAYOUT_GRID.md) | Region splits and dividers, stacked tabs, other pages (project dashboard next), KPI row and projects table as blocks |
| B3 | Block config drawer | ⬜ | | Data source vs view config per block |
| B4 | Layout persistence, menu, reset, versions, sync conflict | 🟡 | `dashboard_layout` table (RLS: own rows in the current workspace), `myLayout` / `saveLayout` (optimistic `baseVersion`, CONFLICT on mismatch) / `resetLayout`; server validates with the shared rules; debounced 800 ms saves; "Layout changed on another device — Keep this / Use other"; Reset with confirm | Team / workspace defaults and the resolution order, locks, version history, sharing, save-as / rename / duplicate, reset preview |
| B5 | Sidebar presets + templates gallery | 🟡 | Project templates (gallery, save as template, download) | Sidebar presets, layout / automation / doc templates, `.tflow` import / export |
| C1 | Tracker: Kanban / Table / List / Calendar / Timeline | ✅ | List, Board, Table, Calendar, Timeline, Team planner, Time report, saved views, filters, grouping. v2 pass on List: soft status pills everywhere, mono `#ID` column, 42px hairline rows, mono column headers, group headers with dot + count; status menu with 1–9 keys; J / K / X / Enter / Esc keyboard; v2 bulk bar | Table and Calendar visual pass, swimlanes, WIP limits, points (no points field yet: estimates are in minutes), PR column |
| C2 | Task detail (full page + peek) | ✅ | v2 layout in modal and side-panel modes: breadcrumb with copy-link `#ID`; header with type, status, time tracking and actions; 30px title; description; subtasks with progress; relations; Development card for linked PRs; Comments / History tabs; right panel with properties and People (assignees, reporter, watchers). Side panel puts properties under the title | Checklists, Create branch / Create PR (needs GitHub write access), attachments, custom fields in the panel, a separate full-page mode, ↑/↓ stepping in the peek |
| C3 | Sprints (planning, health, velocity, complete) | 🟡 | Health strip (name, dates, day X / Y, stacked status bar with counts, straight-line forecast badge: Healthy / At risk / Off track); 3-step completion (summary → destination per unfinished task → review), applied in one transaction by the API (`rollover.moves`, only open tasks of that sprint can move, audited per destination); velocity shows committed vs done (committed is now recorded at completion); planning lanes, backlog, burndown, board | Per-person capacity lanes with leave, scope-change tracking, story points, post report / run "Sprint end" automation |
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

## Screenshots

Current state in [docs/screenshots/v2](../screenshots/v2).

## Next up

Following the handoff's build order (§10), with A1, A2, B1, C1 and C2 done, and B2 / B4 and C3 under way:

1. **C3 rest**: per-person capacity lanes in sprint planning, with leave from HR.
2. **B2 / B4 next steps**: the project dashboard on the grid, then team defaults (B4).
3. **B3 block config drawer**: per-block data source and view settings, kept separate.

Chat, calls and the virtual office (D1–D3) are new products, not gaps. Each needs its own plan (data model, realtime, RLS policies) before any code.
