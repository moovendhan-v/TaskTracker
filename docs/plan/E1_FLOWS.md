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
  - add a watcher;
  - move to another list in the same space.

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

- **Phase 2: time.** Waits and delays, scheduled triggers (due soon, overdue, cron-like schedule) and sprint start/end. This needs a job table with a worker, idempotency keys and retries.
- **Phase 3: reach.** Webhook action (with SSRF rules: allowlisted HTTPS hosts, no private IPs, timeouts, signed payloads), Slack/chat post, chat-message trigger, flow templates, and a test run against a sample task.
