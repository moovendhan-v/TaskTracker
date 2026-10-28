import { FileLockIcon, LockIcon, PencilIcon, PlusIcon, ShieldIcon, TrashIcon } from 'lucide-react';
import { useState } from 'react';
import type { Permission, PolicyResponse } from '@taskflow/shared-types';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { ErrorState } from '@/components/common/error-state';
import { FullPageSpinner } from '@/components/common/full-page-spinner';
import { PageHeader } from '@/components/common/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getErrorMessage } from '@/lib/errors';
import { useWorkspace } from '@/modules/workspaces';
import { PolicyDialog } from '../components/policy-dialog';
import { RoleAccessDialog } from '../components/role-access-dialog';
import { RoleEditorDialog } from '../components/role-editor-dialog';
import { usePolicies, usePolicyMutations } from '../hooks/use-policies';
import { useRoleMutations, useRoles } from '../hooks/use-roles';

export function RolesPage({ workspaceId }: { workspaceId: string }) {
  const { data: workspace } = useWorkspace(workspaceId);
  const grantable = new Set<Permission>(workspace?.permissions ?? []);
  const canManage = grantable.has('roles.manage');
  const [tab, setTab] = useState('roles');

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader
        title="Roles and policies"
        description="Roles get their rights from policies. Policies allow or deny permissions and fields, and a deny can be limited to some spaces."
        icon={<ShieldIcon className="size-5 text-muted-foreground" />}
      />
      <Tabs value={tab} onValueChange={setTab} className="mx-auto grid max-w-4xl gap-4 p-6">
        <TabsList className="justify-self-start">
          <TabsTrigger value="roles">
            <ShieldIcon /> Roles
          </TabsTrigger>
          <TabsTrigger value="policies">
            <FileLockIcon /> Policies
          </TabsTrigger>
        </TabsList>
        <TabsContent value="roles">
          <RolesTab workspaceId={workspaceId} grantable={grantable} canManage={canManage} />
        </TabsContent>
        <TabsContent value="policies">
          <PoliciesTab workspaceId={workspaceId} canManage={canManage} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RolesTab({ workspaceId, grantable, canManage }: { workspaceId: string; grantable: ReadonlySet<Permission>; canManage: boolean }) {
  const roles = useRoles(workspaceId);
  const mutations = useRoleMutations(workspaceId);
  const [accessRoleId, setAccessRoleId] = useState<string | null>(null);
  const accessRole = roles.data?.find((role) => role.id === accessRoleId);
  const onError = (error: unknown) => {
    toast.error(getErrorMessage(error));
    throw error;
  };

  return (
    <div className="grid gap-3">
      {canManage ? (
        <RoleEditorDialog
          trigger={
            <Button size="sm" className="justify-self-end">
              <PlusIcon /> New role
            </Button>
          }
          grantable={grantable}
          onSave={(values) => mutations.create.mutateAsync(values).catch(onError)}
        />
      ) : null}
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
              {role.spaceRules.length > 0 ? <Badge variant="outline">Limited in {role.spaceRules.length === 1 ? 'some spaces' : `${role.spaceRules.length} ways`}</Badge> : null}
            </p>
            <p className="text-xs text-muted-foreground">
              {role.effectivePermissions.length} permissions
              {role.policies.length > 0 ? ` · ${role.policies.map((policy) => policy.name).join(', ')}` : ''}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setAccessRoleId(role.id)}>
            <FileLockIcon /> Policies
          </Button>
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
      {accessRole ? <RoleAccessDialog workspaceId={workspaceId} role={accessRole} canManage={canManage} onClose={() => setAccessRoleId(null)} /> : null}
    </div>
  );
}

function PoliciesTab({ workspaceId, canManage }: { workspaceId: string; canManage: boolean }) {
  const policies = usePolicies(workspaceId);
  const mutations = usePolicyMutations(workspaceId);
  const [editing, setEditing] = useState<PolicyResponse | 'new' | null>(null);
  const custom = (policies.data ?? []).filter((policy) => !policy.managed);
  const managed = (policies.data ?? []).filter((policy) => policy.managed);

  const row = (policy: PolicyResponse) => {
    const spaceLimited = policy.document.statements.some((statement) => statement.spaces?.length || statement.notSpaces?.length);
    return (
      <div key={policy.id} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-medium">
            {policy.name}
            {spaceLimited ? <Badge variant="outline">Space limits</Badge> : null}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {policy.description || `${policy.document.statements.length} statement${policy.document.statements.length === 1 ? '' : 's'}`} · used by {policy.attachedRoleCount}{' '}
            {policy.attachedRoleCount === 1 ? 'role' : 'roles'}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setEditing(policy)}>
          <PencilIcon /> {policy.managed || !canManage ? 'View' : 'Edit'}
        </Button>
        {canManage && !policy.managed ? (
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label={`Delete ${policy.name}`}>
                <TrashIcon />
              </Button>
            }
            title={`Delete ${policy.name}?`}
            description="It is detached from every role that uses it, which can give those roles back what it denied."
            confirmLabel="Delete policy"
            onConfirm={() => mutations.remove.mutateAsync(policy.id)}
          />
        ) : null}
      </div>
    );
  };

  return (
    <div className="grid gap-6">
      <section className="grid gap-3">
        <div className="flex items-center">
          <h2 className="flex-1 text-sm font-semibold">Your policies</h2>
          {canManage ? (
            <Button size="sm" onClick={() => setEditing('new')}>
              <PlusIcon /> New policy
            </Button>
          ) : null}
        </div>
        {policies.isLoading ? <FullPageSpinner /> : null}
        {custom.length === 0 && !policies.isLoading ? (
          <p className="text-sm text-muted-foreground">No policies yet. Create one to, for example, keep a role out of a space or make some spaces read-only.</p>
        ) : null}
        {custom.map(row)}
      </section>
      <section className="grid gap-3">
        <h2 className="text-sm font-semibold">Managed policies</h2>
        {managed.map(row)}
      </section>
      {editing ? (
        <PolicyDialog
          workspaceId={workspaceId}
          policy={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(body) => (editing === 'new' ? mutations.create.mutateAsync(body) : mutations.update.mutateAsync({ policyId: editing.id, body }))}
        />
      ) : null}
    </div>
  );
}
