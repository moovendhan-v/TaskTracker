import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { canManageOrg } from '@taskflow/shared-types';
import { Building2Icon } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { notify } from '@/components/kit/notify';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { organizationKeys, organizationsApi } from '../api/organizations.api';

/**
 * Workspace settings → Organization (A3): which organization the workspace is in, and
 * putting it into one you run (owner or admin) or taking it out. People who manage the
 * workspace see this card; the server checks both sides.
 */
export function WorkspaceOrganizationCard({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const current = useQuery({ queryKey: organizationKeys.ofWorkspace(workspaceId), queryFn: () => organizationsApi.ofWorkspace(workspaceId) });
  const mine = useQuery({ queryKey: organizationKeys.all, queryFn: organizationsApi.list });
  const runnable = (mine.data ?? []).filter((org) => canManageOrg(org.role));
  const [picked, setPicked] = useState('');
  const target = picked || runnable[0]?.id || '';
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: organizationKeys.ofWorkspace(workspaceId) });
    void queryClient.invalidateQueries({ queryKey: organizationKeys.all });
    void queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId] });
  };
  const attach = useMutation({
    mutationFn: () => organizationsApi.attachWorkspace(workspaceId, target),
    onSuccess: () => {
      refresh();
      notify.success('Added to the organization');
    },
    onError: (error) => notify.error(error),
  });
  const detach = useMutation({
    mutationFn: () => organizationsApi.detachWorkspace(workspaceId),
    onSuccess: () => {
      refresh();
      notify.success('Taken out of the organization');
    },
    onError: (error) => notify.error(error),
  });
  const org = current.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2Icon className="size-4 text-muted-foreground" /> Organization
        </CardTitle>
        <CardDescription>
          {org ? (
            <>
              In <span className="font-medium text-foreground">{org.name}</span>. Its security rules apply here too.
            </>
          ) : (
            'Put this workspace in an organization to run it with your other workspaces, under shared security rules.'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        {org ? (
          <ConfirmDialog
            trigger={<Button variant="outline">Take out of {org.name}</Button>}
            title={`Take this workspace out of ${org.name}?`}
            description="Its organization-wide rules stop applying here. Nobody loses access to the workspace."
            confirmLabel="Take out"
            onConfirm={() => detach.mutateAsync()}
          />
        ) : runnable.length ? (
          <>
            <div className="grid gap-1.5">
              <Label htmlFor="workspace-organization">Organization</Label>
              <select
                id="workspace-organization"
                value={target}
                onChange={(event) => setPicked(event.target.value)}
                className="h-9 rounded-md border bg-background px-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {runnable.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
            <Button disabled={!target || attach.isPending} onClick={() => attach.mutate()}>
              Add to organization
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            You don’t run an organization yet.{' '}
            <Link to="/w/$workspaceId/organizations" params={{ workspaceId }} className="font-medium underline">
              Create one
            </Link>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
