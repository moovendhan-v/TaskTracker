import { GitMergeIcon, GitPullRequestClosedIcon, GitPullRequestIcon, TriangleAlertIcon } from 'lucide-react';
import type { PullRequestState } from '@taskflow/shared-types';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { useGithubConflicts, useResolveGithubConflict, useTaskPullRequests } from '../hooks/use-integrations';

const STATE = {
  open: { icon: GitPullRequestIcon, label: 'Open', className: 'text-good' },
  merged: { icon: GitMergeIcon, label: 'Merged', className: 'text-chart-1' },
  closed: { icon: GitPullRequestClosedIcon, label: 'Closed', className: 'text-critical' },
} satisfies Record<PullRequestState, unknown>;

const EVENT_LABEL: Record<PullRequestState, string> = { open: 'opened', merged: 'merged', closed: 'closed without merging' };

/** Pull requests that mention the task, from connected GitHub repositories. Renders nothing when there are none. */
export function PullRequestsSection({ workspaceId, taskId }: { workspaceId: string; taskId: string }) {
  const { data: links = [] } = useTaskPullRequests(workspaceId, taskId);
  const { data: conflicts = [] } = useGithubConflicts(workspaceId, taskId);
  const resolve = useResolveGithubConflict(workspaceId, taskId);
  if (links.length === 0 && conflicts.length === 0) return null;
  return (
    <section aria-labelledby="task-development" className="overflow-hidden rounded-xl border bg-card">
      <header className="flex h-10 items-center gap-2 border-b px-4">
        <GitPullRequestIcon aria-hidden className="size-4 text-muted-foreground" />
        <h3 id="task-development" className="text-[13px] font-semibold">
          Development
        </h3>
        <span className="font-mono text-[11px] text-subtle-foreground">{[...new Set(links.map((link) => link.repo))].join(' · ')}</span>
      </header>
      {conflicts.map((conflict) => (
        <div key={conflict.id} role="group" aria-label={`GitHub conflict for pull request #${conflict.prNumber}`} className="grid gap-2 border-b border-warning/40 bg-warning/5 px-4 py-3 text-sm">
          <p className="flex items-start gap-2">
            <TriangleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
            <span>
              Pull request <span className="font-mono text-[12px]">#{conflict.prNumber}</span> was {EVENT_LABEL[conflict.event]}, which would move this task to <span className="font-medium">{conflict.wantedStatus.name}</span>, but
              it was changed here since. Sync left it as it is.
            </span>
          </p>
          <div className="flex flex-wrap gap-2 pl-6">
            <Button size="sm" disabled={resolve.isPending} onClick={() => resolve.mutate({ conflictId: conflict.id, useGithub: true })}>
              Use GitHub&rsquo;s: {conflict.wantedStatus.name}
            </Button>
            <Button size="sm" variant="outline" disabled={resolve.isPending} onClick={() => resolve.mutate({ conflictId: conflict.id, useGithub: false })}>
              Keep it as it is
            </Button>
          </div>
        </div>
      ))}
      <ul className="divide-y">
        {links.map((link) => {
          const state = STATE[link.state];
          const Icon = state.icon;
          return (
            <li key={link.id}>
              {/* The API only stores https://github.com/ URLs. */}
              <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex h-11 items-center gap-2.5 px-4 text-sm hover:bg-muted/50">
                <Icon className={cn('size-4 shrink-0', state.className)} aria-hidden />
                <span className="font-mono text-[11.5px] font-medium text-muted-foreground">#{link.number}</span>
                <span className="min-w-0 flex-1 truncate">{link.title}</span>
                <span className={cn('shrink-0 rounded-full bg-selected px-2 py-0.5 text-[11px] font-medium', state.className)}>{state.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
