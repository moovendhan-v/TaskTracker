import { spaceVisibility, type SpaceRule, type SpaceScopedPermission, type SpaceVisibility } from '@taskflow/shared-types';

/**
 * Which rows a database transaction may touch. Postgres row-level security
 * policies read it from transaction-local settings (see the
 * row-level-security and space-access migrations), so a query that forgets its
 * `workspace_id` filter still can't reach another tenant's rows.
 *
 * - `workspace`: one workspace's rows. Used for every workspace-scoped operation.
 *   `spaceRules` (from the caller's policies) hide spaces whose task.view is
 *   denied, and the docs of spaces whose doc.view is denied.
 * - `user`: the caller's own memberships, and the workspaces and roles they
 *   hold. Used for operations outside a workspace, such as listing workspaces.
 * - `platform`: every row. Only for platform admin operations and operator CLIs.
 *
 * With no scope set, tenant tables return no rows and reject writes (fail closed).
 */
export type DataScope =
  | { kind: 'workspace'; workspaceId: string; userId: string | null; spaceRules?: readonly SpaceRule[] }
  | { kind: 'user'; userId: string }
  | { kind: 'platform' };

/** How a visibility list travels in a setting: `*` for "no limit", `-` for "no space at all", otherwise comma-separated ids. */
function encodeOnly(only: string[] | null): string {
  if (only === null) return '*';
  return only.length === 0 ? '-' : only.join(',');
}

function settingsFor(visibility: SpaceVisibility): [deny: string, only: string] {
  return [visibility.deny.join(','), encodeOnly(visibility.only)];
}

const NO_LIMIT: SpaceVisibility = { deny: [], only: null };

/** The space limits a scope carries for one permission. */
export function scopeVisibility(scope: DataScope | null, permission: SpaceScopedPermission): SpaceVisibility {
  return scope?.kind === 'workspace' && scope.spaceRules?.length ? spaceVisibility(scope.spaceRules, permission) : NO_LIMIT;
}

/**
 * Values for the settings, in APPLY_SCOPE_SQL's order: `app.workspace_id`,
 * `app.user_id`, `app.scope`, then the task and doc space limits.
 */
export function toScopeSettings(scope: DataScope | null): string[] {
  const spaces = [...settingsFor(scopeVisibility(scope, 'task.view')), ...settingsFor(scopeVisibility(scope, 'doc.view'))];
  if (!scope) return ['', '', '', ...spaces];
  switch (scope.kind) {
    case 'workspace':
      return [scope.workspaceId, scope.userId ?? '', '', ...spaces];
    case 'user':
      return ['', scope.userId, '', ...spaces];
    case 'platform':
      return ['', '', 'platform', ...spaces];
  }
}

/** Sets every setting for the current transaction only (`is_local = true`), so they never leak to the next pooled use. */
export const APPLY_SCOPE_SQL = `SELECT set_config('app.workspace_id', $1, true), set_config('app.user_id', $2, true), set_config('app.scope', $3, true),
  set_config('app.space_task_deny', $4, true), set_config('app.space_task_only', $5, true),
  set_config('app.space_doc_deny', $6, true), set_config('app.space_doc_only', $7, true)`;
