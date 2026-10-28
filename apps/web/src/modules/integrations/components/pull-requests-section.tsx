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
    <section className="grid gap-1.5">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Pull requests</h3>
      <ul className="grid gap-1">
        {links.map((link) => {
          const state = STATE[link.state];
          const Icon = state.icon;
          return (
            <li key={link.id}>
              {/* The API only stores https://github.com/ URLs. */}
              <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                <Icon className={cn('size-4 shrink-0', state.className)} aria-label={state.label} />
                <span className="min-w-0 flex-1 truncate">{link.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {link.repo}#{link.number}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
