import { InboxIcon } from 'lucide-react';
import type { SprintResponse } from '@taskflow/shared-types';
import { EmptyState } from '@/components/common/empty-state';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PriorityIcon, StatusDot, useTaskMutations } from '@/modules/tasks';
import { useBacklog } from '../hooks/use-sprints';

interface BacklogPanelProps {
  workspaceId: string;
  spaceId: string;
  /** Sprints that can still take tasks (planned or active). */
  openSprints: SprintResponse[];
  canPlan: boolean;
  onOpenTask: (taskId: string) => void;
}

export function BacklogPanel({ workspaceId, spaceId, openSprints, canPlan, onOpenTask }: BacklogPanelProps) {
  const { data: tasks = [] } = useBacklog(workspaceId, spaceId);
  const { update } = useTaskMutations(workspaceId);

  return (
    <section className="grid content-start gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <InboxIcon className="size-4 text-muted-foreground" /> Backlog
        <span className="text-xs font-normal text-muted-foreground">{tasks.length} unplanned</span>
      </h2>
      {tasks.length === 0 ? (
        <EmptyState title="Backlog is clear" description="Unfinished tasks that aren't in a sprint show up here." />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-center gap-3 px-3 py-2">
              <StatusDot status={task.status} />
              <button type="button" onClick={() => onOpenTask(task.id)} className="min-w-0 flex-1 truncate text-left text-sm hover:text-primary">
                {task.title}
              </button>
              {task.priority !== 'none' ? <PriorityIcon priority={task.priority} /> : null}
              {canPlan && openSprints.length > 0 ? (
                <Select onValueChange={(sprintId) => update.mutate({ taskId: task.id, body: { sprintId } })}>
                  <SelectTrigger className="h-8 w-40" aria-label={`Plan ${task.title} into a sprint`}>
                    <SelectValue placeholder="Add to sprint" />
                  </SelectTrigger>
                  <SelectContent>
                    {openSprints.map((sprint) => (
                      <SelectItem key={sprint.id} value={sprint.id}>
                        {sprint.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
