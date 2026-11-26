import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BUG_SHARE_DAYS } from '@taskflow/shared-types';
import { LinkIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { getErrorMessage } from '@/lib/errors';
import { queryKeys } from '@/lib/query-keys';
import { timeAgo } from '@/lib/relative-time';
import { intakeApi } from '../api/intake.api';

/** Read-only links to this report for people outside the workspace: made, copied once, revoked. */
export function BugShareSection({ workspaceId, taskId }: { workspaceId: string; taskId: string }) {
  const queryClient = useQueryClient();
  const key = [...queryKeys.tasksRoot(workspaceId), 'bug-shares', taskId];
  const shares = useQuery({ queryKey: key, queryFn: () => intakeApi.shares(workspaceId, taskId) });
  const [days, setDays] = useState('7');
  const [link, setLink] = useState<string | null>(null);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: key });
  const create = useMutation({
    mutationFn: () => intakeApi.share(workspaceId, taskId, Number(days)),
    onSuccess: (created) => {
      const url = `${window.location.origin}${created.path}`;
      setLink(url);
      void navigator.clipboard.writeText(url).then(
        () => toast.success('Link copied'),
        () => undefined,
      );
      refresh();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const revoke = useMutation({ mutationFn: (shareId: string) => intakeApi.revokeShare(workspaceId, shareId), onSuccess: refresh, onError: (error) => toast.error(getErrorMessage(error)) });

  return (
    <section aria-label="Share" className="grid gap-2">
      <h3 className="text-sm font-semibold">Share outside the workspace</h3>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger aria-label="Link lasts" className="h-8 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BUG_SHARE_DAYS.map((value) => (
              <SelectItem key={value} value={String(value)}>
                {value === 1 ? 'For 1 day' : `For ${value} days`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" disabled={create.isPending} onClick={() => create.mutate()}>
          <LinkIcon className="mr-1 size-3.5" /> Create read-only link
        </Button>
      </div>
      {link ? (
        <p className="rounded-md border bg-muted/40 p-2 font-mono text-xs break-all" data-testid="share-link">
          {link}
        </p>
      ) : null}
      {shares.data?.length ? (
        <ul aria-label="Active links" className="grid gap-1 text-xs">
          {shares.data.map((share) => (
            <li key={share.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {share.scope === 'status' ? 'Status link' : 'Full link'} · {share.createdByName ?? 'someone'} · expires {new Date(share.expiresAt).toLocaleDateString()}
                {share.lastViewedAt ? ` · viewed ${timeAgo(share.lastViewedAt)}` : ' · not opened yet'}
              </span>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" disabled={revoke.isPending} onClick={() => revoke.mutate(share.id)}>
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
