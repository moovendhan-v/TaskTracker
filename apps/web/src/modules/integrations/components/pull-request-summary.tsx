import type { TaskPullRequestSummary } from '@taskflow/shared-types';
import { cn } from '@/lib/cn';
import { PULL_REQUEST_STATE } from './pull-requests-section';

/**
 * A task's linked pull requests in a table cell: the state that matters most
 * (open, then merged, then closed) with how many, and the full count in the tooltip.
 */
export function PullRequestSummary({ summary }: { summary: TaskPullRequestSummary | null | undefined }) {
  const total = summary ? summary.open + summary.merged + summary.closed : 0;
  if (!summary || total === 0) return <span className="text-muted-foreground">–</span>;
  const state = summary.open ? 'open' : summary.merged ? 'merged' : 'closed';
  const meta = PULL_REQUEST_STATE[state];
  const Icon = meta.icon;
  const count = summary[state];
  const others = total - count;
  const detail = [summary.open && `${summary.open} open`, summary.merged && `${summary.merged} merged`, summary.closed && `${summary.closed} closed`].filter(Boolean).join(', ');
  return (
    <span className={cn('inline-flex items-center gap-1.5', meta.className)} title={`Pull requests: ${detail}`}>
      <Icon aria-hidden className="size-4" />
      <span className="text-foreground">{count > 1 ? `${count} ${meta.label.toLowerCase()}` : meta.label}</span>
      {others > 0 ? <span className="text-xs text-muted-foreground">+{others}</span> : null}
      <span className="sr-only">({detail})</span>
    </span>
  );
}
