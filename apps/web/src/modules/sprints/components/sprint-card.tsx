import { Link } from '@tanstack/react-router';
import { CheckCheckIcon, KanbanIcon, MoreHorizontalIcon, PencilIcon, PlayIcon, TrashIcon } from 'lucide-react';
import type { SprintResponse } from '@taskflow/shared-types';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/cn';
import { formatSprintRange } from '../lib/sprint-dates';
import { CompleteSprintDialog } from './complete-sprint-dialog';
import { SprintFormDialog, type SprintFormValues } from './sprint-form-dialog';
import { SprintProgress } from './sprint-progress';

const STATUS_BADGE: Record<SprintResponse['status'], { label: string; className: string }> = {
  planned: { label: 'Planned', className: 'bg-secondary text-secondary-foreground' },
  active: { label: 'Active', className: 'bg-primary text-primary-foreground' },
  completed: { label: 'Completed', className: 'bg-status-done/15 text-status-done' },
};

interface SprintCardProps {
  workspaceId: string;
  sprint: SprintResponse;
  plannedSprints: SprintResponse[];
  canManage: boolean;
  onStart: () => Promise<unknown>;
  onComplete: (moveOpenTasksToSprintId: string | null) => Promise<unknown>;
  onUpdate: (values: SprintFormValues) => Promise<unknown>;
  onDelete: () => Promise<unknown>;
}

export function SprintCard({ workspaceId, sprint, plannedSprints, canManage, onStart, onComplete, onUpdate, onDelete }: SprintCardProps) {
  const badge = STATUS_BADGE[sprint.status];

  return (
    <Card className={cn('grid gap-3 p-4', sprint.status === 'active' && 'border-primary/50 shadow-md')}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{sprint.name}</h3>
            <Badge className={badge.className}>{badge.label}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{formatSprintRange(sprint.startDate, sprint.endDate)}</p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/w/$workspaceId/sprints/$sprintId" params={{ workspaceId, sprintId: sprint.id }}>
            <KanbanIcon /> Board
          </Link>
        </Button>
        {canManage && sprint.status !== 'completed' ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`${sprint.name} options`}>
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <SprintFormDialog
                trigger={
                  <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                    <PencilIcon /> Edit
                  </DropdownMenuItem>
                }
                title="Edit sprint"
                submitLabel="Save"
                defaultValues={{ name: sprint.name, goal: sprint.goal, startDate: sprint.startDate, endDate: sprint.endDate }}
                onSubmit={onUpdate}
              />
              {sprint.status === 'planned' ? (
                <ConfirmDialog
                  trigger={
                    <DropdownMenuItem variant="destructive" onSelect={(event) => event.preventDefault()}>
                      <TrashIcon /> Delete
                    </DropdownMenuItem>
                  }
                  title={`Delete ${sprint.name}?`}
                  description="Its tasks go back to the backlog."
                  confirmLabel="Delete sprint"
                  onConfirm={onDelete}
                />
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      {sprint.goal ? <p className="text-sm">{sprint.goal}</p> : null}
      <SprintProgress done={sprint.doneTasks} total={sprint.totalTasks} />
      {canManage && sprint.status === 'planned' ? (
        <Button size="sm" variant="outline" className="justify-self-start" onClick={() => void onStart()}>
          <PlayIcon /> Start sprint
        </Button>
      ) : null}
      {canManage && sprint.status === 'active' ? (
        <CompleteSprintDialog
          trigger={
            <Button size="sm" className="justify-self-start">
              <CheckCheckIcon /> Complete sprint
            </Button>
          }
          sprint={sprint}
          plannedSprints={plannedSprints}
          onComplete={onComplete}
        />
      ) : null}
    </Card>
  );
}
