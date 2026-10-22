import { useNavigate } from '@tanstack/react-router';
import { SettingsIcon, TrashIcon } from 'lucide-react';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { FullPageSpinner } from '@/components/common/full-page-spinner';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/sonner';
import { getErrorMessage } from '@/lib/errors';
import { WorkspaceForm } from '../components/workspace-form';
import { usePermissions } from '../hooks/use-permissions';
import { useDeleteWorkspace, useUpdateWorkspace } from '../hooks/use-workspace-mutations';
import { useWorkspace } from '../hooks/use-workspaces';

export function WorkspaceSettingsPage({ workspaceId }: { workspaceId: string }) {
  const navigate = useNavigate();
  const { data: workspace } = useWorkspace(workspaceId);
  const { can } = usePermissions(workspaceId);
  const update = useUpdateWorkspace(workspaceId);
  const remove = useDeleteWorkspace(workspaceId);

  if (!workspace) return <FullPageSpinner />;
  const canManage = can('workspace.manage');

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader title="Workspace settings" icon={<SettingsIcon className="size-5 text-muted-foreground" />} />
      <div className="mx-auto grid max-w-2xl gap-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>General</CardTitle>
            <CardDescription>{canManage ? 'Rename the workspace or change its colour.' : 'Only owners can change these settings.'}</CardDescription>
          </CardHeader>
          <CardContent>
            {canManage ? (
              <WorkspaceForm
                key={workspace.id}
                defaultValues={{ name: workspace.name, color: workspace.color }}
                submitLabel="Save changes"
                busy={update.isPending}
                onSubmit={(values) =>
                  update.mutate(values, {
                    onSuccess: () => toast.success('Workspace updated'),
                    onError: (error) => toast.error(getErrorMessage(error)),
                  })
                }
              />
            ) : (
              <p className="text-sm">{workspace.name}</p>
            )}
          </CardContent>
        </Card>
        {canManage ? (
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="text-destructive">Delete workspace</CardTitle>
              <CardDescription>Removes every space, list, task, doc and HR record in it. This can't be undone.</CardDescription>
            </CardHeader>
            <CardContent>
              <ConfirmDialog
                trigger={
                  <Button variant="destructive">
                    <TrashIcon /> Delete workspace
                  </Button>
                }
                title={`Delete ${workspace.name}?`}
                description="Everything in this workspace will be permanently deleted."
                confirmLabel="Delete forever"
                onConfirm={() =>
                  remove.mutateAsync(undefined, {
                    onSuccess: () => void navigate({ to: '/' }),
                    onError: (error) => toast.error(getErrorMessage(error)),
                  })
                }
              />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
