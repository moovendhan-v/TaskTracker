import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TWO_STEP_REQUIREMENTS, type TwoStepRequirement } from '@taskflow/shared-types';
import { Link } from '@tanstack/react-router';
import { ShieldCheckIcon } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/sonner';
import { getErrorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';
import { workspacesApi } from '../api/workspaces.api';

const LABEL: Record<TwoStepRequirement, string> = { off: 'Not required', admins: 'People with admin rights', everyone: 'Everyone' };
const EFFECT: Record<TwoStepRequirement, string> = {
  off: 'Anyone can work here with just a password.',
  admins: 'People who manage the workspace, members, roles or integrations, or read the audit log, need it for those rights. Everything else still works.',
  everyone: 'Members without it can open the workspace but do nothing in it until they set it up.',
};

/**
 * Workspace settings → Two-step sign-in (A4 / E3): require an authenticator app or a passkey
 * of admins or everyone. You need it yourself before you can require it, so turning it on
 * never locks you out. Changes are audited.
 */
export function TwoStepRequirementCard({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const key = [...queryKeys.workspace(workspaceId), 'two-step'] as const;
  const policy = useQuery({ queryKey: key, queryFn: () => workspacesApi.twoStepPolicy(workspaceId) });
  const [picked, setPicked] = useState<TwoStepRequirement | null>(null);
  const current = policy.data?.require ?? 'off';
  const value = picked ?? current;
  const save = useMutation({
    mutationFn: () => workspacesApi.setTwoStep(workspaceId, value),
    onSuccess: (saved) => {
      queryClient.setQueryData(key, saved);
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspace(workspaceId) });
      setPicked(null);
      toast.success(saved.require === 'off' ? 'Two-step sign-in is no longer required' : `Two-step sign-in is required of ${LABEL[saved.require].toLowerCase()}`);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const changed = !policy.isLoading && value !== current;
  const blocked = value !== 'off' && policy.data?.callerHasTwoStep === false;
  // Requiring it of more people holds back their rights until they set it up, so ask first.
  const stricter = TWO_STEP_REQUIREMENTS.indexOf(value) > TWO_STEP_REQUIREMENTS.indexOf(current);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheckIcon className="size-4 text-muted-foreground" /> Two-step sign-in
        </CardTitle>
        <CardDescription>Ask for an authenticator app or a passkey on top of the password.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="two-step-required">Require it of</Label>
            <select
              id="two-step-required"
              value={value}
              disabled={policy.isLoading || save.isPending}
              onChange={(event) => setPicked(event.target.value as TwoStepRequirement)}
              className="h-9 rounded-md border bg-background px-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {TWO_STEP_REQUIREMENTS.map((option) => (
                <option key={option} value={option}>
                  {LABEL[option]}
                </option>
              ))}
            </select>
          </div>
          {changed && stricter && !blocked ? (
            <ConfirmDialog
              trigger={<Button disabled={save.isPending}>Save</Button>}
              title={`Require two-step sign-in of ${LABEL[value].toLowerCase()}?`}
              description={`${EFFECT[value]} It applies straight away.`}
              confirmLabel="Require it"
              onConfirm={() => save.mutateAsync()}
            />
          ) : (
            <Button disabled={!changed || blocked || save.isPending} onClick={() => save.mutate()}>
              Save
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{EFFECT[value]}</p>
        {policy.data?.organizationRequire && policy.data.organizationRequire !== 'off' ? (
          <p className="text-xs text-muted-foreground">
            {policy.data.organizationName} requires it of {LABEL[policy.data.organizationRequire].toLowerCase()} in all its workspaces; the stricter rule applies here.
          </p>
        ) : null}
        {blocked ? (
          <p role="alert" className="text-xs text-destructive">
            Set up two-step sign-in for yourself first, so this can never lock you out.{' '}
            <Link to="/w/$workspaceId/security" params={{ workspaceId }} className="font-medium underline">
              Open Security
            </Link>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
