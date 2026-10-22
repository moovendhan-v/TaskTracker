import type { ReactNode } from 'react';
import type { Permission } from '@taskflow/shared-types';
import { usePermissions } from '../hooks/use-permissions';

interface CanProps {
  workspaceId: string;
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}

/** Hides children the user isn't allowed to use. UI convenience only; the API enforces access. */
export function Can({ workspaceId, permission, children, fallback = null }: CanProps) {
  const { can } = usePermissions(workspaceId);
  return <>{can(permission) ? children : fallback}</>;
}
