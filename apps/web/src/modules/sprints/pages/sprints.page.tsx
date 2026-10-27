import { Link } from '@tanstack/react-router';
import { HistoryIcon, PlusIcon, RocketIcon } from 'lucide-react';
import { ErrorState } from '@/components/common/error-state';
import { FullPageSpinner } from '@/components/common/full-page-spinner';
import { ColumnChart } from '@/components/kit/charts';
import { Section } from '@/components/kit/section';
import { Button } from '@/components/ui/button';
import { useOpenTask } from '@/modules/tasks';
import { usePermissions } from '@/modules/workspaces';
import { ActiveSprintPanel } from '../components/active-sprint-panel';
import { BacklogPanel } from '../components/backlog-panel';
import { SprintFormDialog } from '../components/sprint-form-dialog';
import { SprintLane } from '../components/sprint-lane';
import { useSprintMutations, useSprints } from '../hooks/use-sprints';
import { formatSprintRange } from '../lib/sprint-dates';

interface SprintsPageProps {
  workspaceId: string;
  spaceId: string;
}

/**
 * Sprint planning for one project: the running sprint's health on top, then
 * the sprints being planned next to the backlog, then the history with velocity.
 */
export function SprintsPage({ workspaceId, spaceId }: SprintsPageProps) {
  const sprints = useSprints(workspaceId, spaceId);
  const mutations = useSprintMutations(workspaceId, spaceId);
  const { canIn } = usePermissions(workspaceId);
  const canManage = canIn(spaceId, 'sprint.manage');
  const openTask = useOpenTask();

  const all = sprints.data ?? [];
  const active = all.find((sprint) => sprint.status === 'active');
  const planned = all.filter((sprint) => sprint.status === 'planned').sort((a, b) => a.startDate.localeCompare(b.startDate));
  const completed = all.filter((sprint) => sprint.status === 'completed').sort((a, b) => b.endDate.localeCompare(a.endDate));
  const lanes = [...(active ? [active] : []), ...planned];

  const lane = (sprint: (typeof all)[number]) => (
    <SprintLane
      key={sprint.id}
      workspaceId={workspaceId}
      sprint={sprint}
      canManage={canManage}
      canStart={!active}
      onOpenTask={openTask}
      onStart={() => mutations.start.mutateAsync(sprint.id)}
      onUpdate={(values) => mutations.update.mutateAsync({ sprintId: sprint.id, body: values })}
      onDelete={() => mutations.remove.mutateAsync(sprint.id)}
    />
  );

  if (sprints.isLoading) return <FullPageSpinner />;
  if (sprints.isError) return <ErrorState error={sprints.error} onRetry={() => void sprints.refetch()} />;

  return (
    <div className="mx-auto grid max-w-7xl gap-6 pb-10">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">Sprints</h2>
          <p className="text-sm text-muted-foreground">Plan the backlog into short, time-boxed sprints, then run one at a time.</p>
        </div>
        {canManage ? (
          <SprintFormDialog
            formName="sprint.create"
            trigger={
              <Button size="sm">
                <PlusIcon /> New sprint
              </Button>
            }
            title="New sprint"
            submitLabel="Create sprint"
            defaultValues={{ name: `Sprint ${all.length + 1}` }}
            onSubmit={(values) => mutations.create.mutateAsync(values)}
          />
        ) : null}
      </div>

      {active ? (
        <ActiveSprintPanel
          workspaceId={workspaceId}
          sprint={active}
          plannedSprints={planned}
          canManage={canManage}
          onComplete={(moveOpenTasksToSprintId) => mutations.complete.mutateAsync({ sprintId: active.id, body: { moveOpenTasksToSprintId } })}
        />
      ) : (
        <div className="flex items-center gap-4 rounded-2xl border border-dashed bg-card px-5 py-4">
          <RocketIcon className="size-8 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">No sprint is running</p>
            <p className="text-sm text-muted-foreground">
              {planned.length ? `Start ${planned[0]?.name} when the team is ready.` : 'Create a sprint, plan some tasks into it, then start it.'}
            </p>
          </div>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-4">
          <h2 className="text-sm font-semibold">Planning</h2>
          {lanes.length ? lanes.map(lane) : <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No open sprints. Create one to start planning.</p>}
        </div>
        <BacklogPanel workspaceId={workspaceId} spaceId={spaceId} openSprints={lanes} canPlan={canManage} onOpenTask={openTask} />
      </div>

      {completed.length > 0 ? (
        <Section
          variant="card"
          storageKey={`sprints-history:${spaceId}`}
          defaultOpen={false}
          count={completed.length}
          title={
            <span className="flex items-center gap-2">
              <HistoryIcon className="size-4 text-muted-foreground" /> Completed sprints
            </span>
          }
        >
          <div className="grid gap-6 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="grid content-start gap-2">
              <h3 className="text-sm font-semibold">Velocity</h3>
              <p className="text-xs text-muted-foreground">Tasks finished per sprint, oldest to newest.</p>
              <ColumnChart
                label="Tasks finished per completed sprint"
                data={[...completed]
                  .reverse()
                  .slice(-8)
                  .map((sprint) => ({ key: sprint.id, label: sprint.name, value: sprint.doneTasks, tooltip: `${sprint.name} · ${sprint.doneTasks} of ${sprint.totalTasks} done` }))}
                showValues
              />
            </div>
            <ul className="divide-y rounded-lg border">
              {completed.map((sprint) => (
                <li key={sprint.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <Link to="/w/$workspaceId/sprints/$sprintId" params={{ workspaceId, sprintId: sprint.id }} className="min-w-0 flex-1 truncate font-medium hover:text-primary">
                    {sprint.name}
                  </Link>
                  <span className="text-xs text-muted-foreground">{formatSprintRange(sprint.startDate, sprint.endDate)}</span>
                  <span className="w-24 text-right text-xs tabular-nums">
                    {sprint.doneTasks}/{sprint.totalTasks} done
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      ) : null}
    </div>
  );
}
