# E1: Automation flows (canvas, branches, traces)

Design refs: handoff §5.10 and Features `#7a–7b` (flow canvas, node catalogue). Builds on the rule builder that exists today: one trigger, AND-ed conditions, up to 10 actions, run as the rule's owner, and a run history.

## What changes

Today a rule is flat: *when X, if all of these hold, do A, B, C*. A **flow** is a small tree:

```
Trigger ── If priority is urgent ──┬── yes: Assign @Dana → Comment "On it"
                                   └── no:  If due within 2 days ── yes: Set priority high
```

- **Steps** come in three kinds:
  - **action**: what happens;
  - **if/else**: a condition, with a *yes* branch and a *no* branch;
  - **stop**: end here.
- **A tree, not a free graph.** There are no cycles and no joins, so a flow always ends, and it can be drawn, read and checked easily. Limits: at most 30 steps and 5 levels of nesting.
- **Existing rules keep working.** A rule without a `flow` runs exactly as now. Opening one in the canvas shows it converted (its conditions become one if-step, its actions become the yes branch), and saving it stores the flow.

## Catalogue (phase 1)

- **Triggers:** the 9 we have (task created / status / assigned / priority / due date / commented, PR opened / merged / closed).
- **Conditions (if-steps):**
  - status category or status;
  - priority;
  - type;
  - list;
  - assignee (anyone, unassigned, or specific people);
  - due date (overdue, within N days, no date);
  - title contains text (plain, case-insensitive, no regex).
- **Actions:**
  - the 5 we have (set status, set priority, assign, unassign, notify);
  - add a comment (plain text with the same `{{task}}` placeholders);
  - set due date (+N days from now, or clear it);
  - add a watcher.
  - *Move to another list* waits until tasks can move between lists through the API, which they can't yet.

## Run traces

`automation_run` gains `trace jsonb`: one entry per step reached, `{ stepId, kind, outcome: ran | skipped | failed | took-yes | took-no, detail }`. Details are plain text from us, never task content beyond a title. The run history panel shows the path a run took through the tree, with the failing step marked.

## Canvas (web)

- A **vertical flow canvas**, not a free-form node editor:
  - cards from top to bottom;
  - an if-step splits into a *Yes* column and a *No* column;
  - a **+** between cards adds a step.
- This reads well on any screen width, works fully from the keyboard (Tab through cards, Enter edits, Delete removes with undo), and stays accessible to screen readers. A free-form graph would cost a lot for little gain while flows are trees.
- **Editing:** a side drawer edits the selected step, the same pattern as the block settings drawer.
- **Run history:** a toggle highlights the path of the selected run on the canvas.

## Safety rules (unchanged, restated)

- **Who it runs as:** the rule's owner, with that owner's current access. An action the owner may no longer do fails that step and is traced. It never escalates.
- **No loops:** changes made by automations never trigger other automations, so flows can't loop across rules.
- **Shared validation:** flows are checked with shared rules (`validateFlow`) on the client and server. That covers unknown step kinds, ids inside the workspace, limits, and text lengths.
- **Ownership checks:** every id in a flow (status, list, people) is checked to belong to the rule's workspace and space when it's saved, and again when it runs.
- **Permissions:** creating and changing flows needs `automation.manage` in the space, as now. Rule changes go to the audit log.
- **Text, not code:** comment and notify text is plain text, shown as text.

## Data

- `automation_rule.flow jsonb NULL`: the tree. The trigger stays in its own columns, for fast matching.
- `automation_run.trace jsonb NOT NULL DEFAULT '[]'`.
- No new tables. The existing RLS (tenant and space) covers both columns.

## Build order

1. Shared flow types, `validateFlow`, the converter from flat rules, and unit tests.
2. Engine: walk the tree, run each step through the existing action code, and record the trace. Tests per step kind and for the access checks.
3. API: save and read `flow`, plus the run trace. E2E tests covering ids from another space, limits, and a step that fails because access is gone.
4. Canvas, step drawer and run path overlay; a browser e2e test that builds a two-branch flow and sees it run; screenshots.

## Later phases

- **Phase 2: time (built).**
  - **Wait step**: 5 minutes to 30 days, at most 5 per flow. Steps before it are kept; the run is stored as `waiting` with `resumes_at`, and an `automation_job` row holds the wait step id and a SHA-256 fingerprint of the flow. When it's due, the steps after the wait run (the rest of its branch, then the steps after each enclosing if), as the rule's owner with their access at that moment, and the same run row grows its trace. If the rule was turned off, its flow changed, or the task left the rule's project, the run ends as `skipped` instead.
  - **Scheduled triggers**: *a task is due soon* (0 to 30 days ahead, default 1) and *a task becomes overdue* (due before today, UTC). Each fires once per rule, task and due date (`automation_fire`, unique key), so changing the due date can fire it again. Finished and cancelled tasks are left out.
  - **Scheduler** (`AutomationScheduler`, every `AUTOMATION_TICK_SECONDS`, default 60, 0 turns it off): one platform-scope read finds workspaces with due jobs or scheduled rules; everything else runs in that workspace's scope, one transaction each, under a per-workspace advisory lock, with jobs claimed `FOR UPDATE SKIP LOCKED`. Safe with several API instances. Bounded per tick (200 workspaces, 50 jobs, 100 tasks per rule).
  - Not yet: cron-like schedules and sprint start/end triggers.
- **Phase 3: reach (built).**
  - **Post in chat**: posts as the rule's owner in a channel they can post to now (checked on save and again on each run; never a DM).
  - **Call a webhook**: off unless `AUTOMATION_WEBHOOK_HOSTS` lists hosts. https on 443 only, no credentials or IP literals in the URL, every resolved address must be public (private, loopback, link-local, metadata, CGNAT and reserved ranges are refused) and the connection is pinned to the checked address; no redirects, 5 s timeout, the response is never read (`core/net/outbound-webhook.ts`). The call is queued in `automation_webhook_delivery` inside the run's savepoint (a failed run queues nothing) and sent by the scheduler after commit, outside any transaction, with up to three tries (1 min, 5 min). The body is signed: `X-TaskFlow-Signature: sha256=HMAC(secret, "<timestamp>.<body>")` with `X-TaskFlow-Timestamp` and a unique `X-TaskFlow-Delivery` id. Each rule has its own secret, sealed with the server key; showing or replacing it is audited. The delivery result is written into the run's trace.
  - **Test run**: `previewAutomation` walks the flow against a chosen task with `simulateFlow` (actions applied to a copy of the facts, waits passed through) and lights the path on the canvas. Nothing changes and nothing is sent.
  - **Templates**: four starting points in the builder (urgent bugs, overdue escalation with a wait, due-soon reminder, done → chat).
  - Not yet: a chat-message trigger, cron-like schedules, sprint start / end triggers.
