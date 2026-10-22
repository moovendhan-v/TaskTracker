import type { Permission } from '@taskflow/shared-types';
import { useWorkspace } from './use-workspaces';

/**
 * The caller's permissions in a workspace, for showing or hiding UI.
 * The server checks every request again; this only keeps the interface tidy.
 */
export function usePermissions(workspaceId: string) {
  const { data } = useWorkspace(workspaceId);
  const granted = new Set<Permission>(data?.permissions ?? []);
  return {
    can: (permission: Permission) => granted.has(permission),
    canAll: (...permissions: Permission[]) => permissions.every((p) => granted.has(p)),
  };
}
