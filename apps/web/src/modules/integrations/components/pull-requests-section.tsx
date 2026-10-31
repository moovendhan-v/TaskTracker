import { GitMergeIcon, GitPullRequestClosedIcon, GitPullRequestIcon } from 'lucide-react';
import type { PullRequestState } from '@taskflow/shared-types';
import { cn } from '@/lib/cn';
import { useTaskPullRequests } from '../hooks/use-integrations';

const STATE = {
  open: { icon: GitPullRequestIcon, label: 'Open', className: 'text-good' },
  merged: { icon: GitMergeIcon, label: 'Merged', className: 'text-chart-1' },
  closed: { icon: GitPullRequestClosedIcon, label: 'Closed', className: 'text-critical' },
} satisfies Record<PullRequestState, unknown>;

/** Pull requests that mention the task, from connected GitHub repositories. Renders nothing when there are none. */
export function PullRequestsSection({ workspaceId, taskId }: { workspaceId: string; taskId: string }) {
  const { data: links = [] } = useTaskPullRequests(workspaceId, taskId);
  if (links.length === 0) return null;
  return (
    <section aria-labelledby="task-development" className="overflow-hidden rounded-xl border bg-card">
      <header className="flex h-10 items-center gap-2 border-b px-4">
        <GitPullRequestIcon aria-hidden className="size-4 text-muted-foreground" />
        <h3 id="task-development" className="text-[13px] font-semibold">
          Development
        </h3>
        <span className="font-mono text-[11px] text-subtle-foreground">{[...new Set(links.map((link) => link.repo))].join(' · ')}</span>
      </header>
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
