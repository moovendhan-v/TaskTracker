# B2 + B4 (core): arrangeable dashboard grid

Design refs: Platform `#6a` (arrange mode), Features `#11c` (layout menu, sync conflict). Spec §4.3–4.4.

## Scope of this step

- **Home dashboard** (`pageKey = 'home'`), and since then the **project dashboard** (`pageKey = 'project'`, its own 10 block types, one arrangement per person used for every project). The grid and library take a block registry, so a page brings its own blocks.
- The KPI row and the projects table stay fixed above the grid. The 11 chart and list blocks live on the grid.
- Per-user layouts. Team and workspace defaults, locks, version history and sharing (rest of B4) come later.

## Data

`dashboard_layout` (one row per user, workspace and page):

| column | |
|---|---|
| `id` uuid PK | |
| `workspace_id` uuid → workspace, cascade | |
| `user_id` text → user, cascade | |
| `page_key` text | allowlisted (`home`) |
| `items` jsonb | `[{ id, type, x, y, w, h }]`, validated on the server |
| `version` int | starts at 1, +1 on every save |
| `updated_at` timestamptz | |

Unique `(workspace_id, user_id, page_key)`. **RLS**: forced; `app_can_access_workspace(workspace_id) AND user_id = app_current_user_id()` for both `USING` and `WITH CHECK`, so a layout is visible only to its owner inside the current workspace (platform scope excepted, as on every tenant table).

## API (GraphQL)

- `myLayout(workspaceId, pageKey)`: the caller's layout, or `null` (the client then uses the built-in default).
- `saveLayout(workspaceId, input: { pageKey, baseVersion, items })`: optimistic concurrency. `baseVersion` must equal the stored version (`null` when there is none yet), otherwise `CONFLICT`. Returns the saved layout with its new version.
- `resetLayout(workspaceId, pageKey)`: deletes the caller's row and returns `true`.

All three need `task.view` (same as the dashboard) and take the user only from the session. The server validates items with the same rules the client uses (`@taskflow/shared-types` `validateLayoutItems`): known block types for the page, unique ids, integer cells inside a 12-column grid, sizes within limits, at most 40 items, no overlaps. Personal UI state, so no audit log entry.

## Web

- Pure grid functions (`move`, `resize`, `place`, `compact`, `findSlot`) with tests. Moving or resizing pushes overlapped blocks down, then everything floats up.
- **Arrange mode**: `E` or the Arrange button. Blocks get the dashed accent outline and grip. Drag a header to move, drag the corner handle to resize. Keyboard: focus a block, then `⌥+arrows` moves and `⇧⌥+arrows` resizes. `Delete` removes it with a 10 s Undo toast (also `⌘Z`).
- **Library drawer**: `A` or "Add block". It lists the blocks not on the page, grouped by category, and adds one in the first free slot.
- **Saving**: debounced 800 ms with `baseVersion`. On `CONFLICT` it shows the spec's toast, "Layout changed on another device", with **Keep this** (save again on top of the newer version) or **Use other** (load it).
- **Reset**: back to the built-in default (deletes the saved layout).
