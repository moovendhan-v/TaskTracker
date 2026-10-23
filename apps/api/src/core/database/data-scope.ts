/**
 * Which rows a database transaction may touch. Postgres row-level security
 * policies read it from transaction-local settings (see the
 * row-level-security migration), so a query that forgets its
 * `workspace_id` filter still can't reach another tenant's rows.
 *
 * - `workspace`: one workspace's rows. Used for every workspace-scoped operation.
 * - `user`: the caller's own memberships, and the workspaces and roles they
 *   hold. Used for operations outside a workspace, such as listing workspaces.
 * - `platform`: every row. Only for platform admin operations and operator CLIs.
 *
 * With no scope set, tenant tables return no rows and reject writes (fail closed).
 */
export type DataScope =
  | { kind: 'workspace'; workspaceId: string; userId: string | null }
  | { kind: 'user'; userId: string }
  | { kind: 'platform' };

/** Values for the `app.workspace_id`, `app.user_id` and `app.scope` settings. */
export function toScopeSettings(scope: DataScope): [workspaceId: string, userId: string, platform: string] {
  switch (scope.kind) {
    case 'workspace':
      return [scope.workspaceId, scope.userId ?? '', ''];
    case 'user':
      return ['', scope.userId, ''];
    case 'platform':
      return ['', '', 'platform'];
  }
}

/** Sets all three settings for the current transaction only (`is_local = true`), so they never leak to the next pooled use. */
export const APPLY_SCOPE_SQL =
  "SELECT set_config('app.workspace_id', $1, true), set_config('app.user_id', $2, true), set_config('app.scope', $3, true)";
