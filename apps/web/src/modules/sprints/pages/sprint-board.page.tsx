import { Link } from '@tanstack/react-router';
import { ArrowLeftIcon, KanbanIcon } from 'lucide-react';
import { ErrorState } from '@/components/common/error-state';
import { FullPageSpinner } from '@/components/common/full-page-spinner';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { TaskBoardView, useOpenTask } from '@/modules/tasks';
import { SprintProgress } from '../components/sprint-progress';
import { useSprint, useSprintTasks } from '../hooks/use-sprints';
import { formatSprintRange } from '../lib/sprint-dates';

interface SprintBoardPageProps {
  workspaceId: string;
  sprintId: string;
}

export function SprintBoardPage({ workspaceId, sprintId }: SprintBoardPageProps) {
  const sprint = useSprint(workspaceId, sprintId);
  const tasks = useSprintTasks(workspaceId, sprintId);
  const openTask = useOpenTask();

  if (sprint.isLoading) return <FullPageSpinner />;
  if (sprint.isError || !sprint.data) return <ErrorState error={sprint.error} />;
  const { data } = sprint;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={data.name}
        description={`${formatSprintRange(data.startDate, data.endDate)}${data.goal ? ` · ${data.goal}` : ''}`}
        icon={<KanbanIcon className="size-5 text-muted-foreground" />}
        actions={
          <>
            <div className="w-48">
              <SprintProgress done={data.doneTasks} total={data.totalTasks} />
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/w/$workspaceId/s/$spaceId/sprints" params={{ workspaceId, spaceId: data.spaceId }}>
                <ArrowLeftIcon /> All sprints
              </Link>
            </Button>
          </>
        }
      />
      <div className="min-h-0 flex-1 overflow-auto p-6">
        {tasks.isLoading ? <FullPageSpinner /> : null}
        {tasks.data ? <TaskBoardView workspaceId={workspaceId} spaceId={data.spaceId} tasks={tasks.data} onOpen={openTask} /> : null}
      </div>
    </div>
  );
}
