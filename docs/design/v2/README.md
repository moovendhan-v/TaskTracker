# TaskFlow — Build Spec & Design Handoff

> Implementation guide for Claude Code (or any developer). Build TaskFlow v2 from the HTML design references in `designs/`.
> **Some of this is already built.** Before writing code, fill in the **Build status** table (§2) and skip or extend whatever already exists. Never rebuild a working module just to match this doc. Reconcile it instead.

---

## 0. About the design files

The `.dc.html` files in `designs/` are **high-fidelity design references written in HTML**. They are not production code. Open them in a browser to see the intended look. Recreate them in the real app stack using its own patterns.

- **Fidelity:** hi-fi. The colours, type, spacing, radii and copy are final. Match them closely.
- **Visual language:** dark-first, in the shadcn/ui idiom (zinc neutrals, hairline borders, a single accent colour). Workbench tabs in the Huly style.
- **Source of truth, in priority order:** `TaskFlow v2.dc.html` → `TaskFlow v2 Platform.dc.html` → `TaskFlow v2 Features.dc.html`. The v1 files (`TaskFlow Layout System`, `App Screens`, `App Screens 2`, `Virtual Office`) cover **behaviour only**. Their visual style is superseded.

---

## 1. Recommended stack (if nothing exists yet)

| Concern | Choice |
|---|---|
| Framework | Next.js (App Router) + React + TypeScript |
| UI | **shadcn/ui** + Tailwind CSS + Radix primitives |
| Icons | lucide-react (the designs use Material Symbols; map them 1:1 to lucide equivalents) |
| Fonts | Geist + Geist Mono (`geist` npm package) |
| State | Zustand (client UI/layout state) + TanStack Query (server state) |
| Layout grid | `react-grid-layout` (lego dashboard) + `react-resizable-panels` (region splits) |
| DnD | `@dnd-kit/core` (tabs, kanban, sidebar sections, library → grid) |
| Flow canvas | `@xyflow/react` (React Flow) for automations |
| Editor | Tiptap (docs, rich descriptions, task embeds as custom nodes) |
| Realtime | WebSockets (Socket.IO or Liveblocks / Yjs for docs + layout sync) |
| Video | LiveKit (SFU) for calls, screen share, huddles |
| DB / API | Postgres + Prisma, tRPC or REST; Redis for presence + queues |
| Jobs | BullMQ / Temporal for automation runs, GitHub sync, payroll exports |
| Auth | Auth.js / WorkOS (SSO, SCIM, passkeys) |
| 3D office | CSS 3D transforms (as in the design) or three.js later |

If a codebase already exists, **use its stack**, and map the shadcn concepts onto its component library.

---

## 2. Build status (fill this in first)

Mark every row ✅ built / 🟡 partial / ⬜ not started, then build the ⬜/🟡 rows in the phase order shown in §10.

| # | Module | Design ref | Status | Notes |
|---|---|---|---|---|
| A1 | Theme tokens + Appearance settings | v2 `#4a` | ⬜ | |
| A2 | App shell: Rail + Workbench Tabs | v2 `#1a`, `TF2 Rail`, `TF2 Tabs` | ⬜ | |
| A3 | Org → Workspaces → Spaces model + switcher | Platform `#5a` | ⬜ | |
| A4 | Auth, SSO, workspace restore | Features `#18a` | ⬜ | |
| B1 | Block (widget) frame + states | Features `#11a` | ⬜ | |
| B2 | Lego grid + Arrange mode + library | Platform `#6a` | ⬜ | |
| B3 | Block config drawer (data ≠ view) | Features `#11b` | ⬜ | |
| B4 | Layout persistence, menu, reset, versions, sync conflict | Features `#11c` | ⬜ | |
| B5 | Sidebar presets + templates gallery | Features `#12a–d` | ⬜ | |
| C1 | Tracker: Kanban / Table / List / Calendar / Timeline | v2 `#1a`, Features `#13a` | ⬜ | |
| C2 | Task detail (full page + peek) | Features `#14a` | ⬜ | |
| C3 | Sprints (planning, health, velocity, complete) | Features `#15a–b` | ⬜ | |
| C4 | Dashboards (tabs, visibility) | Features `#13b` | ⬜ | |
| C5 | Docs (tree, editor, embeds, present) | Features `#16a` | ⬜ | |
| C6 | Inbox | v2 `#1a` side panel, v1 App Screens 2 `#11a` | ⬜ | |
| D1 | Chat (channels, threads, task-from-message) | v2 `#2a` | ⬜ | |
| D2 | Video calls, huddles, PiP, incoming call | v2 `#3a–b` | ⬜ | |
| D3 | Virtual office (3D + flat) | Features `#17a`, v1 Virtual Office | ⬜ | |
| E1 | Automations: canvas, nodes, run, history | Platform `#7a–c` | ⬜ | |
| E2 | GitHub two-way sync | Platform `#8a` | ⬜ | |
| E3 | IAM: policies, groups, simulator, explained denial | Platform `#9a–c` | ⬜ | |
| E4 | HR: clock-in, attendance, leave, timesheets | Platform `#10a–b` | ⬜ | |
| F1 | Mobile / tablet responsive | Features `#18b–c`, Platform `#10b` | ⬜ | |

---

## 3. Design tokens

All theming uses CSS variables on a root wrapper with `data-theme`, `data-accent`, `data-radius` (and `data-density`, `data-font`) attributes. Implement them as shadcn CSS variables in `globals.css`.

### 3.1 Neutrals

| Token | Dark | Light | Use |
|---|---|---|---|
| `--bg` | `#09090b` | `#ffffff` | app background |
| `--rail` | `#0c0c0e` | `#fafafa` | rail, side panels |
| `--card` | `#111113` | `#ffffff` | cards / blocks |
| `--muted` | `#18181b` | `#f4f4f5` | segmented bg, inputs |
| `--muted2` | `#232327` | `#ececee` | chips, selected row, hover |
| `--border` | `#27272a` | `#e4e4e7` | hairline borders |
| `--border2` | `#3f3f46` | `#d4d4d8` | strong borders, outlines |
| `--fg` | `#fafafa` | `#09090b` | primary text |
| `--fg2` | `#a1a1aa` | `#52525b` | secondary text |
| `--fg3` | `#71717a` | `#a1a1aa` | tertiary / meta |
| `--canvas` | `#050506` | `#f4f4f5` | page behind frames (design canvas only) |

### 3.2 Status

| Token | Dark | Light |
|---|---|---|
| `--ok` | `#22c55e` | `#16a34a` |
| `--warn` | `#f59e0b` | `#d97706` |
| `--bad` | `#ef4444` | `#dc2626` |
| `--info` | `#60a5fa` | `#2563eb` |

Task status colours: To do `#a1a1aa` · In progress `#60a5fa` · In review `#f59e0b` · Done `#22c55e` · Blocked `#ef4444`. Status pills use a `color-mix(in oklab, <c> 16%, transparent)` background with the full colour for the text and dot.

### 3.3 Accent (user-selectable)

| `data-accent` | `--acc` | `--acc2` |
|---|---|---|
| `orange` (default) | `#f97316` | `#ea580c` |
| `blue` | `#3b82f6` | `#2563eb` |
| `emerald` | `#10b981` | `#059669` |
| `rose` | `#f43f5e` | `#e11d48` |
| `zinc` | `#a1a1aa` | `#71717a` |

Derived: `--acc-soft: color-mix(in oklab, var(--acc) 14%, transparent)`, `--acc-soft2: … 40%`. Primary CTAs use either `--fg` bg + `--bg` text (shadcn default) or `--acc` bg + white text (for emphasis: Start sprint, Knock, Add task, Clock in).

### 3.4 Radius

| `data-radius` | `--r` (controls) | `--r2` (cards) |
|---|---|---|
| `sm` | 4px | 6px |
| `md` (default) | 8px | 12px |
| `lg` | 12px | 16px |

Pills and chips are always `999px`. Avatars are circles.

### 3.5 Type

- **Geist** for the UI. **Geist Mono** for IDs (`TF-142`), branches, times, counts, JSON and kbd hints.
- The Appearance settings let the user switch the UI font to Inter or IBM Plex Sans.
- Scale (px): 10.5 mono label · 11.5 meta · 12.5 dense body · **13 base** · 14 large body · 16–18 panel title · 20–24 page title · 28–38 hero / doc title.
- Weights: 400 / 500 / 600. Headlines use letter-spacing `-0.02em` to `-0.045em`.
- Section labels: Geist Mono, 600 weight, 10.5px, letter-spacing `.06em`, uppercase, `--fg3`.

### 3.6 Spacing, sizing, effects

- 4px grid. Common gaps: 2 / 4 / 6 / 8 / 10 / 12 / 14 / 16 / 20 / 24.
- Row heights: table 42, list 36–40, block header 40–42, tab bar 42, top toolbars 44–52.
- Rail width 60. Side panel 250–340. Right peek 340–420.
- Borders are 1px, using `--border` or `--border2`.
- Popover shadow: `0 16px 40px rgba(0,0,0,.5)` (dark). Frame shadow: `0 30px 80px -20px rgba(0,0,0,.6)`.
- Focus ring: `0 0 0 3px var(--acc-soft)` + `border-color: var(--acc)`.
- Hero glow (optional, decorative): `box-shadow: -40px 0 90px -40px var(--acc), 40px 0 90px -40px #3b82f6`.

### 3.7 Density (Appearance setting)

`compact` / `default` / `comfortable` multiply row heights by 0.85 / 1 / 1.15. Implement this as a `--row` CSS var.

---

## 4. Core architecture concepts

### 4.1 Tenancy

```
Organization (Acme Inc)            ← billing, SSO/SCIM, IAM, HR, audit
 └─ Workspace (Engineering, Ops…)  ← members subset, integrations, automations
     └─ Space (Platform, Web…)     ← lists, sprints, docs, views
         └─ List (Backend, Web)    ← tasks
```

- HR, IAM and audit live at the **org** level and are shared across workspaces.
- Resource naming is ARN-like: `org/acme/ws/eng/space/platform/task/TF-142`.

### 4.2 Workbench tabs (Huly-style)

- Every route opens as a **tab** in the top tab strip (`TF2 Tabs`). Tabs can be pinned (icon only), reordered (drag), closed, split (side-by-side), and restored on login.
- Tab state: `{ id, route, title, icon, pinned, splitWith?, scroll, layoutId }[]`, persisted per user per workspace and synced across devices.
- Shortcuts: `⌘T` new tab, `⌘W` close, `⌘1–9` jump, `⌘⇧[ / ]` cycle, `⌘\` split.

### 4.3 Blocks (widgets) and layouts — "lego"

A page is a **Layout**, and a layout is regions holding blocks.

```ts
type Layout = {
  id: string; pageKey: string;            // e.g. "space:platform:sprint"
  scope: 'user'|'team'|'workspace';
  lockedRegions: RegionKey[];             // admin-published locks
  regions: Record<RegionKey, Region>;     // left | main | right | top | dock
  version: number; updatedAt: string; deviceId: string;
};
type Region = { visible: boolean; collapsed?: boolean; size?: number; // % or px
  grid: GridItem[] };                     // react-grid-layout items
type GridItem = { i: string; x: number; y: number; w: number; h: number; block: BlockInstance };
type BlockInstance = {
  type: BlockType;                        // 'tasks' | 'burndown' | 'clockin' | 'office' | …
  title?: string; color?: string;
  source: DataSource;                     // WHAT data
  view: ViewConfig;                       // HOW it looks (table/kanban/…)
  followContext?: boolean;                // listens to page selection
  tabs?: BlockInstance[];                 // stacked tabs in one slot
  refresh?: 'live'|'1m'|'5m'|'manual';
};
type DataSource = { kind: 'space'|'list'|'sprint'|'filter'|'person'; id: string; filters: Filter[] };
type ViewConfig = { mode: 'table'|'list'|'kanban'|'calendar'|'timeline'|'cards';
  groupBy?: string; sortBy?: string; measure?: 'count'|'points'|'time'; fields: string[];
  swimlanes?: string; wip?: Record<string, number>; dateRange?: [string,string] };
```

**Rules**

- Switching the view mode **never** touches the source or the filters.
- Blocks communicate through a page-level **context bus**: `selection: { taskId?, projectId?, personId? }`. A block with `followContext` re-queries when the selection changes and shows a "Linked to …" chip.
- Each block owns its own loading, error and permission state. One block failing never breaks the page (use an error boundary per block).
- Arrange mode (`E`): show dashed region outlines, grips and resize handles, light up drop zones, and open the library drawer (`A`). Keyboard: `⌥+arrows` moves the focused block, `⇧⌥+arrows` resizes it.
- Region dividers snap to 25 / 33 / 50 / 66 / 75 and show a live ratio badge while dragging. Double-click resets to 50.
- Removing a block shows an undo toast (10s, `⌘Z`).

**Block catalogue** (library drawer, grouped):
Tasks (table, list, kanban, calendar, timeline, team planner, backlog, task detail, quick add) · Planning (sprint board, sprint health, burndown, burnup, velocity, capacity, roadmap) · Insights (KPI tile, bar/line/pie, cumulative flow, workload, cycle time) · Navigation (spaces tree, favourites, recent, saved filters, pinned tabs, inbox) · Collaboration (chat channel, activity, comments, doc viewer, notes, announcement) · Calls (live call, huddle, upcoming meetings) · Dev (GitHub PRs, branches, CI status, PR inbox, sync log) · Automation (runs, trigger button) · People/HR (who's online, virtual office, clock-in, attendance, leave calendar, timesheet, approvals).

### 4.4 Layout persistence & sync

- Auto-save is debounced (800ms) to `PUT /layouts/:id` with an `If-Match: version` header.
- On login, show **"Restoring your workspace…"** with a step list (org, theme, layouts and tabs, block data, presence).
- On conflict (a newer version from another device), show the toast "Layout changed on another device — **Keep this** / **Use other**".
- Layout menu: Save as new · Rename · Duplicate · Share (me / team / workspace) · Set as default for page · Lock regions (admin) · Version history (restore) · Reset to default (the confirm dialog shows previews of the current and default layouts).
- Resolution order: user override → team published default → workspace default → built-in template.

### 4.5 Appearance (user preferences)

This lives in the `user_prefs` table and syncs to every device. Fields: `theme (dark|light|system)`, `accent`, `radius`, `font`, `density`, `sidebar (expanded|rail|hidden)`, `tabBehavior (newTabOnOpen|reuse)`, `reduceMotion`, `codeFont`. The settings show a live preview and a "Reset to defaults" button (v2 `#4a`).

---

## 5. Screen-by-screen spec

> For each screen, the design ref is the anchor ID inside the file (open it with `#id`). Match the layout and copy exactly.

### 5.1 App shell — v2 `#1a`, components `TF2 Rail`, `TF2 Tabs`

- **Rail (60px):** org logo at the top; then app icons (Home, Tracker, Chat, Video, Docs, Automations, HR, Admin) with an active indicator (accent bar plus `--muted2` bg); presence avatar and settings at the bottom. Hovering an icon shows a tooltip with its shortcut.
- **Tab strip (42px):** tabs show an icon + title + close ×. The active tab uses `--bg` with a top accent line, inactive tabs are `--fg3`. The strip ends with `+` and a ⌘K search trigger. Arrange mode shows an "Arranging" banner state.
- **Side panel (250px):** a navigation layout (see the §5.6 sidebar presets).

### 5.2 Tracker — v2 `#1a`, Features `#13a`

- **View bar:** List · Board · Table · Calendar · Timeline · Team planner · Time · Sprints · Dashboard · Automations · Settings, plus saved custom views (bookmark icon) and `+`.
- **Filter row:** removable pill chips, `+ Filter`, saved filters, then Group / Sort / Fields / Swimlanes buttons.
- **Table:** 42px rows; columns are checkbox, ID (mono), title, status pill, assignee avatars (stacked, -6px), priority (icon + label), pts, due, PR. Group headers show count, points and WIP (amber when at the limit).
- **Inline edit:** clicking a cell opens a popover (status: searchable, number-key shortcuts 1–5).
- **Bulk bar:** appears when 1+ rows are selected. It floats bottom-centre and offers Status, Assign, Sprint, Labels, Run flow, Delete, ×.
- **Kanban:** columns with WIP counters and optional swimlanes; cards show ID, title, label, PR and avatar.
- Keys: `J/K` move, `X` select, `↵` open, `Space` peek.

### 5.3 Task detail — Features `#14a`

- **Header:** breadcrumb, type pill, ID with copy, status dropdown, recurring flag, a timer button (accent soft) and a Thread button.
- **Body:** title (32px/600), rich description (Tiptap), checklist with a progress bar, subtasks, relations (Blocks / Blocked by / Duplicates), attachments.
- **Development card:** linked branch (copyable), PR row with state, CI and reviewers, and the "Create branch" / "Create PR" buttons. Branch format: `tf-142-fix-login-crash`.
- **Activity tabs:** Activity / Comments / History / Time. The feed includes automation entries, GitHub sync entries and time logs.
- **Right panel (340px):** property grid (status, priority, dates, estimate, sprint, list, labels, time logged, recurring, GitHub sync state, chat thread), then People (assignees, reviewer, reporter) and Custom fields.
- **Peek variant:** the same data in a 420px right panel or block, with ↑/↓ to step through tasks and ⤢ to open the full tab.

### 5.4 Sprints — Features `#15a–b`

- **Health strip:** stacked progress bar (done, in progress, review, blocked), scope change, a forecast badge, and "Complete sprint…".
- **Planning:** backlog (30%) | next sprint card (70%, accent outline) with per-person capacity lanes. Lanes go amber when at 100% and show leave. Dragging a ghost card shows a dashed accent border.
- **Velocity:** committed vs done bars for the last 8 sprints; the current sprint is accent.
- **Complete flow:** 3 steps (summary → unfinished-work destination per task → confirm), with an option to post a report and run the "Sprint end" automation.

### 5.5 Dashboards — Features `#13b`

- Dashboard tabs each carry a visibility badge (Private / Team / Workspace). A date-range control sits on the right.
- It is the same lego grid: KPI tiles with sparklines, burndown (area + ideal dashed + scope line), workload bars (red when over capacity), cycle time histogram, office mini-block and overdue list.

### 5.6 Sidebar presets & templates — Features `#12a–d`

- Presets: **Default** (my issues, inbox, spaces tree, favourites, online), **Minimal** (inbox, my tasks, sprint, favourites/folders/links), **Manager** (dashboards, teams, people, workload mini-chart).
- The templates gallery has tabs for Layouts / Projects / Automations / Docs, and cards with a thumbnail preview, tag (Built-in / Acme / Mine), Use, Preview and block count. It also has "Save current layout" and Import / Export (`.tflow` JSON).

### 5.7 Docs — Features `#16a`

- Tree (250px) + editor (720px column). The toolbar ends with presence avatars, Present, Export (PDF / MD / HTML) and Share.
- Live cursors with name flags (Yjs).
- Task embeds as inline cards, and embedded live views (a filtered task table). `/` opens blocks; typing `TF-` autocompletes tasks.
- Presentation mode splits slides at H2.

### 5.8 Chat — v2 `#2a`

- Channels, DMs and threads. Any message has the action "Create task", which pre-fills the title and links the message. Every task has a thread.
- Task embeds render as rich cards in messages. Huddle start buttons sit on channels.
- A live call floats as a PiP window over other tabs.

### 5.9 Video calls — v2 `#3a–b`

- Call tab: screen share stage, a speaker strip, and controls (mic, cam, share, react, record, leave).
- The side panel is a layout with People / Chat / Tasks (per-person yesterday / today / blocked) / Notes.
- Incoming call toast with Accept / Decline, and a pre-join lobby (device pickers, preview).

### 5.10 Virtual office — Features `#17a`, v1 `TaskFlow Virtual Office`, component `Office Floor`

- Isometric floor built with CSS transforms (`rotateX(55deg) rotateZ(45deg)`) and billboarded labels. Rooms map to teams.
- Avatar states: working (lit desk + task card with timer), away (dimmed), meeting (in the meeting room), leave (empty desk + tag), focus (headphones, DND).
- Ambient signals: done-today shelf, sprint plant (%), CI light, merge confetti.
- Hovering a person shows their profile (now, done today, local time, Knock / Chat / Call). Clicking a desk opens that person's tasks in the right panel.
- A **flat grid** toggle covers accessibility and reduced motion. The office is also available as a block (compact mode).

### 5.11 Organization & workspaces — Platform `#5a`

- Org home lists the workspaces (members, spaces, activity). The workspace switcher has search, recent workspaces, "Create workspace" and org settings.

### 5.12 Lego dashboard / Arrange — Platform `#6a`

- Home in arrange mode: the accent frame outline, block grips and × buttons, the library drawer (search, category chips, block cards), a drag ghost and a lit drop slot, and top-bar actions (Undo / Reset / Done `E`).

### 5.13 Automations — Platform `#7a–c`

- **Canvas** (React Flow): trigger → conditions (AND/OR groups) → if/else → actions → wait → notify. Each node card shows a type header, a summary and a status tick after a run. Edges are dashed accent while executing.
- **Data mapping:** every node exposes an output schema. The variable picker inserts `{{trigger.pr.title}}`-style tokens.
- **Execution panel:** a step-by-step trace with timings, Re-run, and run history.
- **Node catalogue** (`#7b`). Triggers: task created / changed / status / assigned / due soon / overdue / commented / moved; sprint start / end; PR opened / merged / closed / review requested; push; CI failed; schedule; manual button; webhook; chat message; call ended; clock-in / out; leave requested. Logic: filter, AND/OR, if/else, switch, loop, wait / delay, merge. Actions: create task / subtask from template, set fields, assign (person / round-robin / least busy), move list / sprint, comment, checklist, notify (in-app, email, Slack), post in chat, start call, webhook / HTTP, create branch, comment on PR, approve timesheet, run another flow.
- **List** (`#7c`): name, scope, trigger, runs, success rate, owner, on/off, plus a templates row.
- **Backend:** event bus (outbox table) → flow matcher → job queue → step executor with idempotency keys and per-step retries. Persist `flow_runs` and `flow_run_steps`.

### 5.14 GitHub two-way sync — Platform `#8a`

- Connect a repo with the GitHub App (webhook URL plus a secret shown once).
- **Field mapping table:** TaskFlow field ⇄ GitHub field, with direction per field (→, ←, ⇄) and the conflict winner (TaskFlow / GitHub / latest).
- Status mapping: PR opened → In review, merged → Done, closed → To do. Issue state ⇄ task status.
- A live sync log (direction icon, entity, change, time) and a **conflict card** with both values and a "Use TaskFlow / Use GitHub" choice.
- A PR inbox for unlinked PRs with Create task / Link.
- Link rules: branch contains the ID; title or body mentions `TF-\d+`; "fixes TF-x" closes the task on merge.
- **Backend:** webhook receiver → normalise → sync engine with `external_links (task_id, gh_node_id, etag, last_synced_hash)` → loop prevention via an origin tag.

### 5.15 IAM — Platform `#9a–c`, Features `#11a` (no-access block)

- **Policies:** JSON documents with `Effect`, `Action[]` (`task:Delete`, `automation:Publish`, `layout:Lock`, `hr:ApproveTimesheet` …), `Resource[]` (ARN-like with wildcards) and `Condition` (`space in / not in`, time, MFA). The editor has Visual and JSON views side by side.
- **Groups:** members + attached policies. Users inherit from groups; direct attachment is allowed.
- **Evaluation:** explicit Deny > Allow > implicit deny. Build a pure `evaluate(principal, action, resource, ctx)` function, used both server-side and in the **simulator** (`#9c`).
- **Explained denial:** blocks and actions show which statement denied them and offer "Request access".
- Every action in the UI must map to an action name. Keep a registry: `actions.ts`.
- Audit-log every policy change and every denial.

### 5.16 HR — Platform `#10a–b`, Features (leave / timesheet)

- **Clock-in** from web, phone (geofence / Wi-Fi rules) or kiosk, with break tracking.
- **Manager view:** who's in, late or absent; attendance chart; approvals queue (timesheets, leave, overtime).
- **Leave calendar:** month grid with typed blocks (leave, sick, conference, pending as dashed).
- **Timesheet:** task rows × days, auto-filled from task timers. "Submit week" goes into an approval flow.
- **Phone clock-in** screen: big button, location check, today's shifts.
- Payroll export and approvals run through automations.

### 5.17 Auth & restore — Features `#18a`

- Email → SSO, GitHub or passkey. Then "Restoring your workspace…" (§4.4).

### 5.18 Responsive — Features `#18b–c`, Platform `#10b`

- **≥1280:** full shell. **768–1279:** rail only; side panel becomes a slide-over; peek becomes a sheet. **<768:** single stacked column; regions become swipeable pill tabs (Main / Detail / Panel / Dock); bottom tab bar (Home, Chat, Sprint, Calls, Clock); floating `+` opens the quick-add sheet with natural-language parsing (`tomorrow @dev !high`).

---

## 6. Shared component inventory (build in shadcn)

Button (default / outline / ghost / destructive / accent) · Pill / Badge (status, priority, label, visibility) · Avatar (+ presence dot + stack) · Kbd · Segmented control · Tabs (workbench, underline) · Command palette (⌘K) · Popover menu with shortcuts · Dialog (reset, complete sprint) · Sheet / drawer (library, config, peek) · Toast (undo, sync conflict, saved) · Toggle switch · Data table (grouped, selectable, inline-edit) · Kanban board · Block frame · Region divider · Drop zone · Sparkline / area / bar charts (Recharts or visx) · Flow node card · PR chip · CI badge · Timer pill · Office avatar.

**Block frame anatomy (Features `#11a`):** 40px header with [grip (arrange only)] icon · title · filter chip · view switcher · ⋯ menu (Configure C, Duplicate ⌘D, Maximise M, Pop out to side panel, Open as tab ⌘↵, Remove ⌫). States: default, focused / menu, arrange, loading skeleton, error with retry, no-access (diagonal hatch + policy name + Request access), stacked tabs, empty region (invites a block or layout), linked (accent chip).

---

## 7. Data model (minimum)

```
organizations, workspaces, workspace_members, spaces, lists
users, user_prefs, teams, team_members
tasks(id, key 'TF-142', list_id, sprint_id, status, priority, points, estimate, start, due, recurring, custom jsonb)
task_assignees, task_reviewers, task_labels, task_relations(type), checklists, subtasks(parent_id), attachments
comments, activity(entity, kind, actor, payload)
sprints, sprint_capacity
docs(tree parent_id, ydoc bytes), doc_embeds
channels, messages(thread_id, task_id?), calls, call_participants
layouts, layout_versions, tabs_state
flows, flow_versions, flow_runs, flow_run_steps
integrations_github, external_links, sync_log, sync_conflicts
iam_policies, iam_groups, iam_group_members, iam_attachments, audit_log
hr_shifts, hr_clock_events, hr_leave, hr_timesheets, hr_approvals
presence (redis), office_desks
```

---

## 8. Realtime channels

`presence:{ws}` · `task:{id}` · `layout:{userId}` · `chat:{channelId}` · `call:{id}` · `doc:{id}` (Yjs) · `flowrun:{id}` · `sync:{repo}` · `office:{ws}`.

---

## 9. Sample data (use it in seeds and Storybook)

- **Org** Acme Inc → workspaces Engineering, Ops. **Space** Platform (lists Backend, Web), Sprint 14 (Oct 20 → Nov 2), tasks TF-101…TF-160, repo `acme/platform`.
- **Team of 8:** Maya Chen (EM), Dev Patel, Liam O'Connor, Jonas Berg (Platform), Sofia Rossi, Nadia Haddad (Web), Aiko Tanaka (Design), Tomás Silva (QA / Ops).
- **Hero task:** TF-142 "Fix login crash on SSO redirect", PR #418, branch `tf-142-fix-login-crash`.

---

## 10. Build order

1. **Foundation:** tokens + Appearance (A1), shell + tabs (A2), tenancy (A3), auth (A4), IAM `evaluate()` + action registry (E3 core).
2. **Lego core:** block frame (B1), grid + arrange (B2), config (B3), persistence / sync (B4).
3. **Work:** tracker views (C1), task detail (C2), sprints (C3), dashboards (C4), sidebar / templates (B5).
4. **Collaboration:** chat (D1), calls (D2), docs (C5), inbox (C6), office (D3).
5. **Platform:** automations (E1), GitHub sync (E2), IAM UI (E3), HR (E4).
6. **Responsive + polish:** F1, empty / error / skeleton states, keyboard map, a11y audit.

**Acceptance for every block:**
- Works in dark and light, all 5 accents and all 3 radii.
- Keyboard reachable with a visible focus ring.
- Has loading, empty, error and no-access states.
- Survives a reload in the same layout position.

---

## 11. Keyboard map

`⌘K` command · `E` arrange · `A` add block · `Q` quick add · `G H/I/T/C` go home / inbox / tracker / chat · `J/K` move · `X` select · `↵` open · `Space` peek · `⌘Z` undo · `⌘T/W` tabs · `⌘\` split · `⌥+arrows` move block · `⇧⌥+arrows` resize block · `?` shortcuts.

---

## 12. Files in `designs/`

| File | Contains |
|---|---|
| `TaskFlow v2.dc.html` | 1 Tracker + tabs · 2 Chat · 3 Video call + lobby · 4 Appearance |
| `TaskFlow v2 Platform.dc.html` | 5 Org/workspaces · 6 Lego arrange · 7 Automations · 8 GitHub sync · 9 IAM · 10 HR |
| `TaskFlow v2 Features.dc.html` | 11 Block states/config/layout menu · 12 Sidebars/templates · 13 Table + dashboards · 14 Task detail · 15 Sprints · 16 Docs · 17 Office · 18 Login + mobile |
| `TF2 Rail.dc.html`, `TF2 Tabs.dc.html`, `Office Floor.dc.html` | Shared shell + office components |
| `TaskFlow Layout System.dc.html` | v1 — layout system behaviour (splits, sync, versions, locks) |
| `TaskFlow App Screens.dc.html`, `… 2.dc.html` | v1 — behaviour ref for inbox, admin, templates, tablet |
| `TaskFlow Virtual Office.dc.html` | v1 — office flat grid + tile |
| `support.js` | Runtime needed to open the `.dc.html` files in a browser |
