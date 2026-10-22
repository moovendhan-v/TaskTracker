import { LockIcon, PencilIcon, PlusIcon, ShieldIcon, TrashIcon } from 'lucide-react';
import type { Permission } from '@taskflow/shared-types';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { ErrorState } from '@/components/common/error-state';
import { FullPageSpinner } from '@/components/common/full-page-spinner';
import { PageHeader } from '@/components/common/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { getErrorMessage } from '@/lib/errors';
import { useWorkspace } from '@/modules/workspaces';
import { RoleEditorDialog } from '../components/role-editor-dialog';
import { useRoleMutations, useRoles } from '../hooks/use-roles';

export function RolesPage({ workspaceId }: { workspaceId: string }) {
  const roles = useRoles(workspaceId);
  const { data: workspace } = useWorkspace(workspaceId);
  const mutations = useRoleMutations(workspaceId);
  const grantable = new Set<Permission>(workspace?.permissions ?? []);
  const canManage = grantable.has('roles.manage');
  const onError = (error: unknown) => {
    toast.error(getErrorMessage(error));
    throw error;
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader
        title="Roles"
        description="Built-in roles plus custom roles made from permissions."
        icon={<ShieldIcon className="size-5 text-muted-foreground" />}
        actions={
          canManage ? (
            <RoleEditorDialog
              trigger={
                <Button size="sm">
                  <PlusIcon /> New role
                </Button>
              }
              grantable={grantable}
              onSave={(values) => mutations.create.mutateAsync(values).catch(onError)}
            />
          ) : null
        }
      />
      <div className="mx-auto grid max-w-4xl gap-3 p-6">
        {roles.isLoading ? <FullPageSpinner /> : null}
        {roles.isError ? <ErrorState error={roles.error} onRetry={() => void roles.refetch()} /> : null}
        {roles.data?.map((role) => (
          <div key={role.id} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-medium">
                {role.name}
                {role.systemKey ? (
                  <Badge variant="muted">
                    <LockIcon /> Built-in
                  </Badge>
                ) : null}
              </p>
              <p className="text-xs text-muted-foreground">{role.permissions.length} permissions</p>
            </div>
            <RoleEditorDialog
              trigger={
                <Button variant="ghost" size="sm">
                  <PencilIcon /> {role.systemKey || !canManage ? 'View' : 'Edit'}
                </Button>
              }
              role={canManage ? role : { ...role, systemKey: role.systemKey ?? 'custom' }}
              grantable={grantable}
              onSave={(values) => mutations.update.mutateAsync({ roleId: role.id, body: values }).catch(onError)}
            />
            {canManage && !role.systemKey ? (
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="icon-sm" aria-label={`Delete ${role.name}`}>
                    <TrashIcon />
                  </Button>
                }
                title={`Delete ${role.name}?`}
                description="Members must be moved to another role first."
                confirmLabel="Delete role"
                onConfirm={() => mutations.remove.mutateAsync(role.id).catch((error) => toast.error(getErrorMessage(error)))}
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
