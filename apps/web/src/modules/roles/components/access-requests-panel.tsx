import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ACCESS_GRANT_DAYS, type AccessGrantDays } from '@taskflow/shared-types';
import { CheckIcon, ClockIcon, InboxIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { UserAvatar } from '@/components/common/user-avatar';
import { notify } from '@/components/kit/notify';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { timeAgo } from '@/lib/relative-time';
import { accessReviewApi } from '../api/access-review.api';
import { PERMISSION_GROUPS } from '../lib/permission-groups';

const label = (permission: string) => PERMISSION_GROUPS.flatMap((group) => group.permissions).find((item) => item.key === permission)?.label ?? permission;
const DAYS_LABEL: Record<AccessGrantDays, string> = { 1: '1 day', 7: '7 days', 30: '30 days' };

/**
 * For people who manage roles (E3): access requests to approve in one click, as a
 * grant that ends, or decline; and the grants still running, to end early. A deny in
 * someone's role still wins over a grant, and you can only hand out access you have.
 */
export function AccessRequestsPanel({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const key = ['workspaces', workspaceId, 'access-requests'] as const;
  const requests = useQuery({ queryKey: [...key, 'pending'], queryFn: () => accessReviewApi.requests(workspaceId) });
  const grants = useQuery({ queryKey: [...key, 'grants'], queryFn: () => accessReviewApi.grants(workspaceId) });
  const [days, setDays] = useState<AccessGrantDays>(7);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: key });
    void queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'access-check'] });
  };
  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) => accessReviewApi.decide(workspaceId, id, approve, approve ? days : null),
    onSuccess: (result, { approve }) => {
      notify.success(approve ? `Approved for ${DAYS_LABEL[days]}` : 'Declined');
      refresh();
      return result;
    },
    onError: (error) => notify.error(error),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => accessReviewApi.revoke(workspaceId, id),
    onSuccess: () => {
      notify.success('Access ended');
      refresh();
    },
    onError: (error) => notify.error(error),
  });
  const pending = requests.data ?? [];
  const running = grants.data ?? [];
  if (pending.length === 0 && running.length === 0) return null;

  return (
    <div className="grid gap-4">
      {pending.length ? (
        <section aria-labelledby="access-requests" className="grid gap-2 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <InboxIcon aria-hidden className="size-4 text-muted-foreground" />
            <h2 id="access-requests" className="flex-1 text-sm font-semibold">
              Requests <span className="font-mono text-xs text-subtle-foreground">{pending.length}</span>
            </h2>
            <span className="text-xs text-muted-foreground">Approve for</span>
            <div role="radiogroup" aria-label="Approve for" className="flex rounded-md border p-0.5">
              {ACCESS_GRANT_DAYS.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={days === value}
                  onClick={() => setDays(value)}
                  className={cn('h-6 rounded px-2 text-xs transition-colors', days === value ? 'bg-primary-soft font-medium text-ring' : 'text-muted-foreground hover:bg-muted')}
                >
                  {DAYS_LABEL[value]}
                </button>
              ))}
            </div>
          </div>
          <ul className="divide-y">
            {pending.map((request) => (
              <li key={request.id} className="flex flex-wrap items-center gap-3 py-2.5 animate-in fade-in-0 slide-in-from-top-1">
                <UserAvatar name={request.requesterName} className="size-7 text-[10px]" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{request.requesterName}</span> wants <span className="font-medium">{label(request.permission)}</span>
                    {request.spaceName ? <span className="text-muted-foreground"> in {request.spaceName}</span> : <span className="text-muted-foreground"> everywhere</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {request.note ? `“${request.note}” · ` : ''}
                    {timeAgo(request.createdAt)}
                  </p>
                </div>
                <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: request.id, approve: true })} aria-label={`Approve ${request.requesterName}: ${label(request.permission)} for ${DAYS_LABEL[days]}`}>
                  <CheckIcon /> Approve
                </Button>
                <Button size="sm" variant="ghost" disabled={decide.isPending} onClick={() => decide.mutate({ id: request.id, approve: false })} aria-label={`Decline ${request.requesterName}: ${label(request.permission)}`}>
                  <XIcon /> Decline
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {running.length ? (
        <section aria-labelledby="access-grants" className="grid gap-2 rounded-xl border bg-card p-4">
          <h2 id="access-grants" className="flex items-center gap-2 text-sm font-semibold">
            <ClockIcon aria-hidden className="size-4 text-muted-foreground" /> Temporary access
          </h2>
          <ul className="divide-y">
            {running.map((grant) => (
              <li key={grant.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <UserAvatar name={grant.userName} className="size-6 text-[10px]" />
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{grant.userName}</span> · {label(grant.permission)}
                  {grant.spaceName ? ` in ${grant.spaceName}` : ''}
                  <span className="block text-xs text-muted-foreground">
                    Ends {new Date(grant.expiresAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                    {grant.grantedByName ? ` · approved by ${grant.grantedByName}` : ''}
                  </span>
                </span>
                <Button size="sm" variant="outline" disabled={revoke.isPending} onClick={() => revoke.mutate(grant.id)} aria-label={`End ${grant.userName}'s access: ${label(grant.permission)}`}>
                  End now
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
