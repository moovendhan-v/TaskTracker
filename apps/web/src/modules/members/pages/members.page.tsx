import { LogOutIcon, UserMinusIcon, UsersIcon } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { ErrorState } from '@/components/common/error-state';
import { FullPageSpinner } from '@/components/common/full-page-spinner';
import { PageHeader } from '@/components/common/page-header';
import { UserAvatar } from '@/components/common/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { useCurrentUser } from '@/core/auth/use-current-user';
import { formatLongDate } from '@/lib/dates';
import { getErrorMessage } from '@/lib/errors';
import { useRoles } from '@/modules/roles';
import { usePermissions } from '@/modules/workspaces';
import { AddMemberDialog } from '../components/add-member-dialog';
import { RoleSelect } from '../components/role-select';
import { useMemberMutations, useMembers } from '../hooks/use-members';

export function MembersPage({ workspaceId }: { workspaceId: string }) {
  const navigate = useNavigate();
  const members = useMembers(workspaceId);
  const { data: roles = [] } = useRoles(workspaceId);
  const { data: me } = useCurrentUser();
  const { can } = usePermissions(workspaceId);
  const mutations = useMemberMutations(workspaceId);
  const canManage = can('members.manage');
  const onError = (error: unknown) => toast.error(getErrorMessage(error));

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader
        title="Members"
        description="People in this workspace and their roles."
        icon={<UsersIcon className="size-5 text-muted-foreground" />}
        actions={
          <>
            <ConfirmDialog
              trigger={
                <Button variant="outline" size="sm">
                  <LogOutIcon /> Leave
                </Button>
              }
              title="Leave this workspace?"
              description="You'll lose access until someone adds you again."
              confirmLabel="Leave workspace"
              onConfirm={() => mutations.leave.mutateAsync().then(() => navigate({ to: '/' }), onError)}
            />
            {canManage ? <AddMemberDialog workspaceId={workspaceId} roles={roles} /> : null}
          </>
        }
      />
      <div className="mx-auto max-w-4xl p-6">
        {members.isLoading ? <FullPageSpinner /> : null}
        {members.isError ? <ErrorState error={members.error} onRetry={() => void members.refetch()} /> : null}
        <ul className="divide-y rounded-xl border bg-card">
          {members.data?.map((member) => {
            const isMe = member.userId === me?.id;
            return (
              <li key={member.userId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <UserAvatar name={member.name} className="size-9" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {member.name} {isMe ? <Badge variant="muted">You</Badge> : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {member.email} · joined {formatLongDate(member.joinedAt)}
                  </p>
                </div>
                {canManage && !isMe ? (
                  <>
                    <RoleSelect
                      roles={roles}
                      value={member.roleId}
                      onChange={(roleId) => mutations.updateRole.mutate({ userId: member.userId, roleId }, { onError })}
                    />
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label={`Remove ${member.name}`}>
                          <UserMinusIcon />
                        </Button>
                      }
                      title={`Remove ${member.name}?`}
                      description="They'll lose access to this workspace."
                      confirmLabel="Remove"
                      onConfirm={() => mutations.remove.mutateAsync(member.userId).catch(onError)}
                    />
                  </>
                ) : (
                  <Badge variant="secondary">{member.roleName}</Badge>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
